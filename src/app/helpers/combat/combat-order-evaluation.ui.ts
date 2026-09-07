import { skillIsUsableWithEquippedWeapons } from '@helpers/hero/skill';
import type {
  CombatantTargettingType,
  EquipmentItemType,
  EquipmentSkillContent,
} from '@interfaces';

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

// Flags a clause that can never resolve a target given its family + target mode.
export function isCombatOrderTargetModeUsable(
  family: string,
  heroSkills: EquipmentSkillContent[],
  targetMode: CombatantTargettingType | undefined,
): boolean {
  if (
    targetMode !== 'Self' &&
    targetMode !== 'SpecificHero' &&
    targetMode !== 'MatchingAllies'
  ) {
    return true;
  }

  const skill = heroSkills.find((s) => s.family === family);
  if (!skill) return true;

  if (targetMode === 'Self') {
    return skill.techniques.some((tech) => tech.targetType !== 'Enemies');
  }

  // SpecificHero / MatchingAllies both target a (possibly different) ally.
  return skill.techniques.some(
    (tech) => tech.targetType === 'Allies' || tech.targetType === 'All',
  );
}
