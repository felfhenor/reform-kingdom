import { combatCombatantCombatStatSucceedsChance } from '@helpers/combat/combat-stats';
import { getEntry } from '@helpers/content/content';
import {
  skillEpCost,
  skillTechniqueNumTargets,
  skillUses,
} from '@helpers/hero/skill';
import type {
  Combat,
  Combatant,
  CombatantTargettingType,
  CombatTargetModeContext,
  EquipmentSkill,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  EquipmentSkillTargetBehavior,
  EquipmentSkillTargetBehaviorData,
  EquipmentSkillTargetType,
  TargettingPriorityEntry,
} from '@interfaces';
import { intersection, sampleSize, sortBy, union } from 'es-toolkit/compat';

export function combatAvailableSkillsForCombatant(
  combatant: Combatant,
): EquipmentSkill[] {
  return [
    ...combatant.skillIds.map((s) => getEntry<EquipmentSkill>(s)!),
    ...combatant.skillRefs,
  ].filter(
    (skill) =>
      (skill.usesPerCombat === -1 ||
        (combatant.skillUses[skill.id] ?? 0) < skillUses(skill)) &&
      combatant.ep >= skillEpCost(skill),
  );
}

function filterCombatantTargetListForSkillTechniqueBehavior(
  combatants: Combatant[],
  behaviorData: EquipmentSkillTargetBehaviorData,
): Combatant[] {
  const behaviors: Record<
    EquipmentSkillTargetBehavior,
    (c: Combatant[]) => Combatant[]
  > = {
    Always: (list) => list,
    NotMaxHealth: (list) => list.filter((c) => c.hp < c.totalStats.Health),
    NotZeroHealth: (list) => list.filter((c) => c.hp > 0),
    IfStatusEffect: (list) =>
      list.filter((c) =>
        c.statusEffects.find((s) => s.id === behaviorData.statusEffectId),
      ),
    IfNotStatusEffect: (list) =>
      list.filter(
        (c) =>
          !c.statusEffects.find((s) => s.id === behaviorData.statusEffectId),
      ),
  };

  if (!behaviors[behaviorData.behavior])
    throw new Error(`Invalid target behavior: ${behaviorData.behavior}`);

  return behaviors[behaviorData.behavior](combatants);
}

function filterCombatantTargetListForSkillTechnique(
  combatants: Combatant[],
  technique: EquipmentSkillContentTechnique,
): Combatant[] {
  return intersection(
    ...technique.targetBehaviors.map((b) =>
      filterCombatantTargetListForSkillTechniqueBehavior(combatants, b),
    ),
  );
}

function getBaseCombatantTargetListForSkillTechnique(
  combat: Combat,
  combatant: Combatant,
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
): Combatant[] {
  const heroSide = [...combat.heroes, ...combat.helpers];
  const myType = combatant.isEnemy ? 'guardian' : 'hero';
  let allies = myType === 'guardian' ? combat.guardians : heroSide;
  let enemies = myType === 'guardian' ? heroSide : combat.guardians;

  const shouldReverse = combatCombatantCombatStatSucceedsChance(
    combatant,
    'redirectionChance',
  );

  if (shouldReverse) {
    [allies, enemies] = [enemies, allies];
  }

  const targetTypes: Record<EquipmentSkillTargetType, Combatant[]> = {
    All: [...allies, ...enemies],
    Enemies: enemies,
    Allies: allies,
    Self: [combatant],
  };

  if (!targetTypes[technique.targetType])
    throw new Error(`Invalid target type: ${technique.targetType}`);

  return targetTypes[technique.targetType];
}

export function combatGetPossibleCombatantTargetsForSkillTechnique(
  combat: Combat,
  combatant: Combatant,
  skill: EquipmentSkillContent,
  tech: EquipmentSkillContentTechnique,
): Combatant[] {
  const baseList = getBaseCombatantTargetListForSkillTechnique(
    combat,
    combatant,
    skill,
    tech,
  );
  return filterCombatantTargetListForSkillTechnique(baseList, tech);
}

export function combatGetPossibleCombatantTargetsForSkill(
  combat: Combat,
  combatant: Combatant,
  skill: EquipmentSkillContent,
): Combatant[] {
  return union(
    skill.techniques.flatMap((t) =>
      combatGetPossibleCombatantTargetsForSkillTechnique(
        combat,
        combatant,
        skill,
        t,
      ),
    ),
  );
}

export function combatGetTargetsFromListBasedOnType(
  combatants: Combatant[],
  type: CombatantTargettingType,
  select: number,
  context?: CombatTargetModeContext,
): Combatant[] {
  const targetsWithAgro = sortBy(
    combatants.filter((c) => c.combatStats.agroValue > 0),
    (c) => -c.combatStats.agroValue,
  );
  const targetsWithoutAgro = combatants.filter(
    (c) => c.combatStats.agroValue <= 0,
  );

  const targettingActions: Record<CombatantTargettingType, () => Combatant[]> =
    {
      Random: () =>
        [
          ...targetsWithAgro,
          ...sampleSize(targetsWithoutAgro, select - targetsWithAgro.length),
        ].slice(0, select),
      Strongest: () =>
        [
          ...targetsWithAgro,
          ...sortBy(targetsWithoutAgro, (c) => -c.hp).slice(
            0,
            Math.max(0, select - targetsWithAgro.length),
          ),
        ].slice(0, select),
      Weakest: () =>
        [
          ...targetsWithAgro,
          ...sortBy(targetsWithoutAgro, (c) => c.hp).slice(
            0,
            Math.max(0, select - targetsWithAgro.length),
          ),
        ].slice(0, select),
      Self: () => combatants.filter((c) => c === context?.combatant),
      SpecificHero: () =>
        combatants.filter((c) => c.id === context?.targetCharacterId),
      // intersection() narrows matchingAllies down to combatants still in the pool.
      MatchingAllies: () =>
        sampleSize(
          intersection(context?.matchingAllies ?? [], combatants),
          select,
        ),
    };

  return targettingActions[type]();
}

// Tries each priority entry in order, narrowing to entry.jobId (if set) before entry.type
// picks from the narrowed pool - e.g. Weakest + jobId: Healer targets the weakest healer.
// Returns the first entry's non-empty result.
export function combatGetTargetsFromPriorityList(
  combatants: Combatant[],
  priority: TargettingPriorityEntry[],
  select: number,
  context: CombatTargetModeContext,
): Combatant[] {
  for (const entry of priority) {
    const pool = entry.jobId
      ? combatants.filter((c) => c.jobId === entry.jobId)
      : combatants;
    const targets = combatGetTargetsFromListBasedOnType(
      pool,
      entry.type,
      select,
      context,
    );
    if (targets.length > 0) return targets;
  }

  return [];
}

// Lets a combat order clause fall through instead of wasting the turn on zero targets.
export function combatSkillHasValidTargetsForMode(
  combat: Combat,
  combatant: Combatant,
  skill: EquipmentSkillContent,
  mode: CombatantTargettingType,
  context: CombatTargetModeContext,
): boolean {
  return skill.techniques.some((tech) => {
    const baseList = combatGetPossibleCombatantTargetsForSkillTechnique(
      combat,
      combatant,
      skill,
      tech,
    );
    return (
      combatGetTargetsFromListBasedOnType(
        baseList,
        mode,
        skillTechniqueNumTargets(skill, tech),
        context,
      ).length > 0
    );
  });
}
