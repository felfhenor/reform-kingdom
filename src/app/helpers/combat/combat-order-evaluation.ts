import { combatantIsDead } from '@helpers/combat/combat-combatant-hp';
import { combatSkillHasValidTargetsForMode } from '@helpers/combat/combat-targetting';
import { rngChoice } from '@helpers/rng';
import type {
  Combat,
  Combatant,
  CombatOrderComparator,
  CombatOrderCondition,
  CombatOrderHealthCountCondition,
  CombatOrderPick,
  EquipmentSkill,
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

function healthPercent(combatant: Combatant): number {
  if (combatant.totalStats.Health <= 0) return 0;
  return (combatant.hp / combatant.totalStats.Health) * 100;
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
      ? healthPercent(c) > condition.healthPercent
      : healthPercent(c) < condition.healthPercent,
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
        healthPercent(combatant),
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
    case 'SpecificHeroHealthPercent': {
      const hero = livingAllies(combat, combatant).find(
        (ally) => ally.id === condition.characterId,
      );
      if (!hero) return false;
      return compareNumbers(
        healthPercent(hero),
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
    ? sortBy(matches, (c) => healthPercent(c))
    : sortBy(matches, (c) => -healthPercent(c));
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
    const needsValidityCheck =
      targetMode === 'Self' ||
      targetMode === 'SpecificHero' ||
      targetMode === 'MatchingAllies' ||
      targetMode === 'MatchingEnemies';

    // Only the new modes can resolve to zero targets - others are unchanged from before.
    if (!needsValidityCheck) return { skill, targetMode };

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
