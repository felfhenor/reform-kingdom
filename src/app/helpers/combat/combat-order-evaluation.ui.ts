import {
  combatOrderClauseBlockingSkill,
  combatOrderSkillBlockedBy,
} from '@helpers/combat/combat-order-evaluation';
import { skillIsUsableWithEquippedWeapons } from '@helpers/hero/skill';
import type {
  Combatant,
  EquipmentItemType,
  EquipmentSkill,
  EquipmentSkillContent,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// Edit-time warning helpers; skill lists are resolved by the caller to keep this file pure.
export function isCombatOrderFamilyKnown(
  family: string,
  heroSkills: EquipmentSkillContent[],
): boolean {
  return heroSkills.some((skill) => skill.family === family);
}

export function isCombatOrderFamilyUsable(
  family: string,
  heroSkills: EquipmentSkillContent[],
  equippedWeaponTypes: EquipmentItemType[],
): boolean {
  const skill = heroSkills.find((s) => s.family === family);
  return (
    !!skill && skillIsUsableWithEquippedWeapons(skill, equippedWeaponTypes)
  );
}

export function isCombatOrderFamilyEquipmentOnly(
  family: string,
  jobOnlySkills: EquipmentSkillContent[],
): boolean {
  return !jobOnlySkills.some((skill) => skill.family === family);
}

// Skills an earlier unconditional clause starves of every turn they could otherwise take.
export function combatOrderBlockedFamilies(
  combatant: Combatant,
  skills: EquipmentSkill[],
): string[] {
  const ordered = new Set<string>();

  for (const clause of combatant.combatOrders) {
    if (!clause.enabled) continue;
    if (clause.action.type === 'RandomSkill') return [];

    const blocker = combatOrderClauseBlockingSkill(clause, skills);
    if (blocker) {
      const blocked = skills.filter(
        (skill) =>
          !ordered.has(skill.family) &&
          combatOrderSkillBlockedBy(combatant, blocker, skill),
      );
      return uniq(blocked.map((skill) => skill.family));
    }

    ordered.add(clause.action.family);
  }

  return [];
}
