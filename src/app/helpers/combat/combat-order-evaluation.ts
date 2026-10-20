import { skillOwnTechniques } from '@helpers/hero/skill-modifier';
import {
  combatantHealthPercent,
  combatantIsDead,
} from '@helpers/combat/combat-combatant-hp';
import { elementPool } from '@helpers/combat/combat-element-pool';
import { combatOrderTargetModeNeedsValidityCheck } from '@helpers/combat/combat-order-target-mode';
import { combatCombatantSkillEpCost } from '@helpers/combat/combat-stats';
import { combatantHasLivingSummon } from '@helpers/combat/combat-summon';
import { combatSkillHasValidTargetsForMode } from '@helpers/combat/combat-targetting';
import {
  skillCooldown,
  skillHasElementCosts,
  skillUses,
} from '@helpers/hero/skill';
import { rngChoice } from '@helpers/rng';
import type {
  Combat,
  Combatant,
  CombatOrderClause,
  CombatOrderComparator,
  CombatOrderCondition,
  CombatOrderHealthCountCondition,
  CombatOrderPick,
  EquipmentSkill,
  EquipmentSkillContentTechnique,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

function compareNumbers(
  a: number,
  comparator: CombatOrderComparator,
  b: number,
): boolean {
  switch (comparator) {
    case 'LessThan':
      return a < b;
    case 'LessThanOrEqual':
      return a <= b;
    case 'Equal':
      return a === b;
    case 'GreaterThanOrEqual':
      return a >= b;
    case 'GreaterThan':
      return a > b;
  }
}

function energyPercent(combatant: Combatant): number {
  if (combatant.totalStats.Energy <= 0) return 0;
  return (combatant.ep / combatant.totalStats.Energy) * 100;
}

// The caster counts as their own ally; dead combatants are excluded.
function livingAllies(combat: Combat, combatant: Combatant): Combatant[] {
  const pool = combatant.isEnemy
    ? combat.guardians
    : [...combat.heroes, ...combat.helpers];
  return pool.filter((c) => !combatantIsDead(c));
}

function livingEnemies(combat: Combat, combatant: Combatant): Combatant[] {
  const pool = combatant.isEnemy
    ? [...combat.heroes, ...combat.helpers]
    : combat.guardians;
  return pool.filter((c) => !combatantIsDead(c));
}

function combatantsMatchingHealthCount(
  combat: Combat,
  combatant: Combatant,
  condition: CombatOrderHealthCountCondition,
): Combatant[] {
  const pool =
    condition.type === 'AllyCountHealthPercent'
      ? livingAllies(combat, combatant)
      : livingEnemies(combat, combatant);

  return pool.filter((c) =>
    condition.healthDirection === 'Above'
      ? combatantHealthPercent(c) > condition.healthPercent
      : combatantHealthPercent(c) < condition.healthPercent,
  );
}

export function combatOrderConditionMatches(
  condition: CombatOrderCondition,
  combat: Combat,
  combatant: Combatant,
): boolean {
  switch (condition.type) {
    case 'Always':
      return true;
    case 'SelfHealthPercent':
      return compareNumbers(
        combatantHealthPercent(combatant),
        condition.comparator,
        condition.value,
      );
    case 'SelfEnergyPercent':
      return compareNumbers(
        energyPercent(combatant),
        condition.comparator,
        condition.value,
      );
    case 'AllyCountHealthPercent':
    case 'EnemyCountHealthPercent':
      return compareNumbers(
        combatantsMatchingHealthCount(combat, combatant, condition).length,
        condition.comparator,
        condition.count,
      );
    case 'EnemyCount':
      return compareNumbers(
        livingEnemies(combat, combatant).length,
        condition.comparator,
        condition.count,
      );
    case 'SelfHasNoSummon':
      return !combatantHasLivingSummon(combat, combatant);
    case 'ElementCount':
      return compareNumbers(
        elementPool(combat)[condition.element],
        condition.comparator,
        condition.count,
      );
    case 'SpecificHeroHealthPercent': {
      const hero = livingAllies(combat, combatant).find(
        (ally) => ally.id === condition.characterId,
      );
      if (!hero) return false;
      return compareNumbers(
        combatantHealthPercent(hero),
        condition.comparator,
        condition.value,
      );
    }
  }
}

// Sorted most-relevant-first, so a skill with fewer targets than matches still lands on the ones that matter most.
export function matchingCombatantsForCondition(
  combat: Combat,
  combatant: Combatant,
  condition: CombatOrderCondition,
): Combatant[] | undefined {
  if (
    condition.type !== 'AllyCountHealthPercent' &&
    condition.type !== 'EnemyCountHealthPercent'
  ) {
    return undefined;
  }

  const matches = combatantsMatchingHealthCount(combat, combatant, condition);
  return condition.healthDirection === 'Below'
    ? sortBy(matches, (c) => combatantHealthPercent(c))
    : sortBy(matches, (c) => -combatantHealthPercent(c));
}

// Resolves a skill family (stable across tiers/source) to a currently castable skill.
export function resolveFamilyToSkill(
  family: string,
  availableSkills: EquipmentSkill[],
): EquipmentSkill | undefined {
  return availableSkills.find((skill) => skill.family === family);
}

// First enabled clause that resolves, matches, and has a valid target wins; undefined falls back to weighted-random.
export function pickSkillFromCombatOrders(
  combat: Combat,
  combatant: Combatant,
  availableSkills: EquipmentSkill[],
): CombatOrderPick | undefined {
  for (const clause of combatant.combatOrders) {
    if (!clause.enabled) continue;

    if (clause.action.type === 'RandomSkill') {
      if (availableSkills.length === 0) return undefined;
      return { skill: rngChoice(availableSkills) };
    }

    const skill = resolveFamilyToSkill(clause.action.family, availableSkills);
    if (
      !skill ||
      !combatOrderConditionMatches(clause.condition, combat, combatant)
    ) {
      continue;
    }

    const targetMode = clause.action.targetMode;
    if (!combatOrderTargetModeNeedsValidityCheck(targetMode)) {
      return { skill, targetMode };
    }

    const matchingCombatants = matchingCombatantsForCondition(
      combat,
      combatant,
      clause.condition,
    );
    const context = {
      combatant,
      targetCharacterId: clause.action.targetCharacterId,
      matchingCombatants,
    };

    if (
      !combatSkillHasValidTargetsForMode(
        combat,
        combatant,
        skill,
        targetMode,
        context,
      )
    ) {
      continue;
    }

    return {
      skill,
      targetMode,
      targetCharacterId: clause.action.targetCharacterId,
      matchingCombatants,
    };
  }

  return undefined;
}

// An empty behavior list filters out every target, so it never qualifies.
function techniqueTargetsAnyLiving(
  technique: EquipmentSkillContentTechnique,
): boolean {
  return (
    technique.targetBehaviors.length > 0 &&
    technique.targetBehaviors.every(
      ({ behavior }) => behavior === 'Always' || behavior === 'NotZeroHealth',
    )
  );
}

function skillOnlyLimitedByEnergy(skill: EquipmentSkill): boolean {
  return (
    skillUses(skill) === -1 &&
    skillCooldown(skill) === 0 &&
    !skillHasElementCosts(skill) &&
    skill.techniques.some(techniqueTargetsAnyLiving)
  );
}

// The caster is always a living ally or self, but enemies can all fall mid-round while heroes still act.
function skillAlwaysHasTarget(skill: EquipmentSkill): boolean {
  return skillOwnTechniques(skill).some(
    (tech) => techniqueTargetsAnyLiving(tech) && tech.targetType !== 'Enemies',
  );
}

// An "Always" clause whose skill is cast on every turn its caster can afford it, so it starves every clause and skill behind it.
export function combatOrderClauseBlockingSkill(
  clause: CombatOrderClause,
  skills: EquipmentSkill[],
): EquipmentSkill | undefined {
  if (!clause.enabled || clause.condition.type !== 'Always') return undefined;
  if (clause.action.type !== 'CastSkillFamily') return undefined;
  if (combatOrderTargetModeNeedsValidityCheck(clause.action.targetMode)) {
    return undefined;
  }

  const skill = resolveFamilyToSkill(clause.action.family, skills);
  return skill && skillOnlyLimitedByEnergy(skill) ? skill : undefined;
}

// Skipping the blocker for EP leaves nothing pricier affordable; skipping it for lack of enemies leaves enemy-only skills targetless too.
export function combatOrderSkillBlockedBy(
  combatant: Combatant,
  blocker: EquipmentSkill,
  skill: EquipmentSkill,
): boolean {
  if (skill.family === blocker.family) return false;
  if ((combatant.combatStats.redirectionChance ?? 0) > 0) return false;
  if (
    combatCombatantSkillEpCost(combatant, skill) <
    combatCombatantSkillEpCost(combatant, blocker)
  ) {
    return false;
  }

  return (
    skillAlwaysHasTarget(blocker) ||
    skill.techniques.every((tech) => tech.targetType === 'Enemies')
  );
}
