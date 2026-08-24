import { combatantIsDead } from '@helpers/combat/combat-end';
import { combatSkillHasValidTargetsForMode } from '@helpers/combat/combat-targetting';
import { skillIsUsableWithEquippedWeapons } from '@helpers/hero/skill';
import { rngChoice } from '@helpers/rng';
import type {
  Combat,
  Combatant,
  CombatantTargettingType,
  CombatOrderComparator,
  CombatOrderCondition,
  CombatOrderPick,
  EquipmentItemType,
  EquipmentSkill,
  EquipmentSkillContent,
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
  const pool = combatant.isEnemy ? combat.guardians : combat.heroes;
  return pool.filter((c) => !combatantIsDead(c));
}

function livingEnemies(combat: Combat, combatant: Combatant): Combatant[] {
  const pool = combatant.isEnemy ? combat.heroes : combat.guardians;
  return pool.filter((c) => !combatantIsDead(c));
}

function alliesMatchingHealthDirection(
  combat: Combat,
  combatant: Combatant,
  healthDirection: 'Above' | 'Below',
  healthPercentThreshold: number,
): Combatant[] {
  const matchesDirection = (ally: Combatant) =>
    healthDirection === 'Above'
      ? healthPercent(ally) > healthPercentThreshold
      : healthPercent(ally) < healthPercentThreshold;

  return livingAllies(combat, combatant).filter(matchesDirection);
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
      const count = alliesMatchingHealthDirection(
        combat,
        combatant,
        condition.healthDirection,
        condition.healthPercent,
      ).length;
      return compareNumbers(count, condition.comparator, condition.count);
    }
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
export function matchingAlliesForCondition(
  combat: Combat,
  combatant: Combatant,
  condition: CombatOrderCondition,
): Combatant[] | undefined {
  if (condition.type !== 'AllyCountHealthPercent') return undefined;

  const matches = alliesMatchingHealthDirection(
    combat,
    combatant,
    condition.healthDirection,
    condition.healthPercent,
  );

  return condition.healthDirection === 'Below'
    ? sortBy(matches, (ally) => ally.hp)
    : sortBy(matches, (ally) => -ally.hp);
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
      targetMode === 'MatchingAllies';

    // Only the new modes can resolve to zero targets - others are unchanged from before.
    if (!needsValidityCheck) return { skill, targetMode };

    const matchingAllies = matchingAlliesForCondition(
      combat,
      combatant,
      clause.condition,
    );
    const context = {
      combatant,
      targetCharacterId: clause.action.targetCharacterId,
      matchingAllies,
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
      matchingAllies,
    };
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
  if (!skill) return true; // isCombatOrderFamilyKnown already flags this case

  if (targetMode === 'Self') {
    return skill.techniques.some((tech) => tech.targetType !== 'Enemies');
  }

  // SpecificHero / MatchingAllies both target a (possibly different) ally.
  return skill.techniques.some(
    (tech) => tech.targetType === 'Allies' || tech.targetType === 'All',
  );
}
