import type {
  CombatantTargettingType,
  CombatOrderCondition,
  EquipmentSkillContent,
} from '@interfaces';
import { skillOwnTechniques } from '@helpers/hero/skill-modifier';

// These modes can resolve to zero targets, so the engine checks them before committing to a clause.
export function combatOrderTargetModeNeedsValidityCheck(
  targetMode: CombatantTargettingType | undefined,
): targetMode is CombatantTargettingType {
  return (
    targetMode === 'Self' ||
    targetMode === 'SpecificHero' ||
    targetMode === 'MatchingAllies' ||
    targetMode === 'MatchingEnemies'
  );
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
  if (!combatOrderTargetModeNeedsValidityCheck(targetMode)) return true;

  const skill = heroSkills.find((s) => s.family === family);
  if (!skill) return true;

  const techniques = skillOwnTechniques(skill);
  if (targetMode === 'Self') {
    return techniques.some((tech) => tech.targetType !== 'Enemies');
  }

  const side = targetMode === 'MatchingEnemies' ? 'Enemies' : 'Allies';
  return techniques.some(
    (tech) => tech.targetType === side || tech.targetType === 'All',
  );
}
