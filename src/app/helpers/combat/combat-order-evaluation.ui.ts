import { skillIsUsableWithEquippedWeapons } from '@helpers/hero/skill';
import type {
  CombatantTargettingType,
  CombatOrderCondition,
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

// Matching* modes target the condition's own matches, so they only make sense with that condition.
export function isCombatOrderTargetModeAllowedForCondition(
  targetMode: CombatantTargettingType | undefined,
  conditionType: CombatOrderCondition['type'],
): boolean {
  if (targetMode === 'MatchingAllies') {
    return conditionType === 'AllyCountHealthPercent';
  }
  if (targetMode === 'MatchingEnemies') {
    return conditionType === 'EnemyCountHealthPercent';
  }
  return true;
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
    targetMode !== 'MatchingAllies' &&
    targetMode !== 'MatchingEnemies'
  ) {
    return true;
  }

  const skill = heroSkills.find((s) => s.family === family);
  if (!skill) return true;

  if (targetMode === 'Self') {
    return skill.techniques.some((tech) => tech.targetType !== 'Enemies');
  }

  const side = targetMode === 'MatchingEnemies' ? 'Enemies' : 'Allies';
  return skill.techniques.some(
    (tech) => tech.targetType === side || tech.targetType === 'All',
  );
}
