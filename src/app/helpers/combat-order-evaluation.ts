import { combatantIsDead } from '@helpers/combat-end';
import { rngChoice } from '@helpers/rng';
import { skillIsUsableWithEquippedWeapons } from '@helpers/skill';
import type {
  Combat,
  Combatant,
  CombatOrderCondition,
  CombatOrderComparator,
  CombatOrderPick,
  EquipmentItemType,
  EquipmentSkill,
  EquipmentSkillContent,
} from '@interfaces';

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
  const pool = combatant.isEnemy ? combat.guardians : combat.heroes;
  return pool.filter((c) => !combatantIsDead(c));
}

function livingEnemies(combat: Combat, combatant: Combatant): Combatant[] {
  const pool = combatant.isEnemy ? combat.heroes : combat.guardians;
  return pool.filter((c) => !combatantIsDead(c));
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
    case 'AllyCountHealthPercent': {
      const matchesDirection = (ally: Combatant) =>
        condition.healthDirection === 'Above'
          ? healthPercent(ally) > condition.healthPercent
          : healthPercent(ally) < condition.healthPercent;

      const count = livingAllies(combat, combatant).filter(
        matchesDirection,
      ).length;
      return compareNumbers(count, condition.comparator, condition.count);
    }
    case 'EnemyCount':
      return compareNumbers(
        livingEnemies(combat, combatant).length,
        condition.comparator,
        condition.count,
      );
  }
}

// Resolves a skill family (stable across tiers/source) to a currently castable skill.
export function resolveFamilyToSkill(
  family: string,
  availableSkills: EquipmentSkill[],
): EquipmentSkill | undefined {
  return availableSkills.find((skill) => skill.family === family);
}

// First enabled clause that resolves and matches wins; undefined means callers should fall back to weighted-random.
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
      skill &&
      combatOrderConditionMatches(clause.condition, combat, combatant)
    ) {
      return { skill, targetMode: clause.action.targetMode };
    }
  }

  return undefined;
}

// Edit-time warning helpers; skill lists are resolved by the caller (job.ts) to keep this file pure.
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
