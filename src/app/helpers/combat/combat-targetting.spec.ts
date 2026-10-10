import {
  combatAvailableSkillsForCombatant,
  combatGetTargetsFromListBasedOnType,
  combatGetTargetsFromPriorityList,
  combatSkillHasValidTargetsForMode,
} from '@helpers/combat/combat-targetting';
import type {
  CharacterId,
  CombatTargetModeContext,
  EquipmentSkillContentTechnique,
  EquipmentSkillId,
  JobId,
  StatusEffectId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { ensureEquipmentSkillTechnique } from '@helpers/content/ensure-skill';
import { defaultCombatStats } from '@helpers/defaults';
import {
  buildCombat,
  buildEquipmentSkill,
  buildStatusEffect,
  buildTestCombatant,
} from '@/testing/builders';
import { describe, expect, it } from 'vitest';

function buildTechnique(
  overrides: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return ensureEquipmentSkillTechnique({
    targetType: 'Allies',
    targetBehaviors: [{ behavior: 'Always' }],
    ...overrides,
  });
}

describe('combatAvailableSkillsForCombatant', () => {
  const combat = buildCombat();

  it('excludes skills whose epCost exceeds the combatant current ep', () => {
    const affordable = buildEquipmentSkill({
      id: 'cheap' as EquipmentSkillId,
      epCost: 5,
    });
    const tooExpensive = buildEquipmentSkill({
      id: 'expensive' as EquipmentSkillId,
      epCost: 15,
    });

    const combatant = buildTestCombatant({
      ep: 10,
      skillRefs: [affordable, tooExpensive],
    });

    const available = combatAvailableSkillsForCombatant(combat, combatant);

    expect(available.map((s) => s.id)).toEqual(['cheap']);
  });

  it('includes a skill whose epCost exactly matches the combatant current ep', () => {
    const skill = buildEquipmentSkill({ epCost: 10 });
    const combatant = buildTestCombatant({ ep: 10, skillRefs: [skill] });

    expect(combatAvailableSkillsForCombatant(combat, combatant)).toEqual([
      skill,
    ]);
  });

  it('excludes a skill made unaffordable by an EP cost increase', () => {
    const skill = buildEquipmentSkill({ epCost: 10 });
    const combatant = buildTestCombatant({
      ep: 10,
      skillRefs: [skill],
      combatStats: { ...defaultCombatStats(), epCostIncreasePercent: 50 },
    });

    expect(combatAvailableSkillsForCombatant(combat, combatant)).toEqual([]);
  });

  it('still excludes skills that are out of uses even if ep is available', () => {
    const skill = buildEquipmentSkill({
      id: 'limited' as EquipmentSkillId,
      epCost: 0,
      usesPerCombat: 1,
    });
    const combatant = buildTestCombatant({
      ep: 10,
      skillRefs: [skill],
      skillUses: { ['limited' as EquipmentSkillId]: 1 },
    });

    expect(combatAvailableSkillsForCombatant(combat, combatant)).toEqual([]);
  });

  it('excludes a skill whose element costs exceed the pool', () => {
    const skill = buildEquipmentSkill({
      elementCosts: { Fire: 2, Water: 0, Earth: 0, Air: 0 },
    });
    const combatant = buildTestCombatant({ skillRefs: [skill] });

    const short = buildCombat({
      elements: { Fire: 1, Water: 2, Earth: 2, Air: 2 },
    });
    const full = buildCombat({
      elements: { Fire: 2, Water: 0, Earth: 0, Air: 0 },
    });

    expect(combatAvailableSkillsForCombatant(short, combatant)).toEqual([]);
    expect(combatAvailableSkillsForCombatant(full, combatant)).toEqual([skill]);
  });

  it('excludes a skill on cooldown', () => {
    const skill = buildEquipmentSkill({ id: 'burst' as EquipmentSkillId });
    const combatant = buildTestCombatant({
      skillRefs: [skill],
      skillCooldowns: { ['burst' as EquipmentSkillId]: 1 },
    });

    expect(combatAvailableSkillsForCombatant(combat, combatant)).toEqual([]);
  });
});

describe('combatGetTargetsFromListBasedOnType', () => {
  it('Self returns only the caster from the given list', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const ally = buildTestCombatant({ id: 'ally' });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatGetTargetsFromListBasedOnType([caster, ally], 'Self', 1, context),
    ).toEqual([caster]);
  });

  it('Self returns nothing when the caster is not in the given list', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const ally = buildTestCombatant({ id: 'ally' });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatGetTargetsFromListBasedOnType([ally], 'Self', 1, context),
    ).toEqual([]);
  });

  it('SpecificHero returns only the combatant matching the target character id', () => {
    const target = buildTestCombatant({ id: 'target-hero' });
    const other = buildTestCombatant({ id: 'other-hero' });
    const context: CombatTargetModeContext = {
      combatant: other,
      targetCharacterId: 'target-hero' as CharacterId,
    };

    expect(
      combatGetTargetsFromListBasedOnType(
        [target, other],
        'SpecificHero',
        1,
        context,
      ),
    ).toEqual([target]);
  });

  it('SpecificHero returns nothing when the target character is not in the given list', () => {
    const other = buildTestCombatant({ id: 'other-hero' });
    const context: CombatTargetModeContext = {
      combatant: other,
      targetCharacterId: 'missing-hero' as CharacterId,
    };

    expect(
      combatGetTargetsFromListBasedOnType([other], 'SpecificHero', 1, context),
    ).toEqual([]);
  });

  it('MatchingAllies only selects from combatants present in both matchingCombatants and the pool', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const critical = buildTestCombatant({ id: 'critical', hp: 5 });
    const wounded = buildTestCombatant({ id: 'wounded', hp: 40 });

    const context: CombatTargetModeContext = {
      combatant: caster,
      matchingCombatants: [critical, wounded],
    };

    const result = combatGetTargetsFromListBasedOnType(
      [wounded, critical],
      'MatchingAllies',
      2,
      context,
    );

    expect(sortBy(result, (c) => c.id)).toEqual([critical, wounded]);
  });

  it('MatchingAllies excludes matches no longer present in the base target pool', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const critical = buildTestCombatant({ id: 'critical', hp: 5 });
    const noLongerValid = buildTestCombatant({ id: 'no-longer-valid', hp: 1 });

    const context: CombatTargetModeContext = {
      combatant: caster,
      matchingCombatants: [noLongerValid, critical],
    };

    expect(
      combatGetTargetsFromListBasedOnType(
        [critical],
        'MatchingAllies',
        5,
        context,
      ),
    ).toEqual([critical]);
  });

  it('MatchingEnemies selects from the same matched list as MatchingAllies', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const lowEnemy = buildTestCombatant({ id: 'low', isEnemy: true, hp: 5 });
    const otherEnemy = buildTestCombatant({
      id: 'other',
      isEnemy: true,
      hp: 90,
    });

    expect(
      combatGetTargetsFromListBasedOnType(
        [lowEnemy, otherEnemy],
        'MatchingEnemies',
        2,
        { combatant: caster, matchingCombatants: [lowEnemy] },
      ),
    ).toEqual([lowEnemy]);
  });

  it('Matching modes keep the matched order when there are more matches than targets', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const lowest = buildTestCombatant({ id: 'lowest', hp: 5 });
    const low = buildTestCombatant({ id: 'low', hp: 20 });
    const context = { combatant: caster, matchingCombatants: [lowest, low] };

    expect(
      combatGetTargetsFromListBasedOnType(
        [low, lowest],
        'MatchingAllies',
        1,
        context,
      ),
    ).toEqual([lowest]);
    expect(
      combatGetTargetsFromListBasedOnType(
        [low, lowest],
        'MatchingEnemies',
        1,
        context,
      ),
    ).toEqual([lowest]);
  });

  it('MatchingEnemies still hits a taunting enemy first, even one outside the matches', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const lowEnemy = buildTestCombatant({ id: 'low', isEnemy: true, hp: 5 });
    const taunter = buildTestCombatant({
      id: 'taunter',
      isEnemy: true,
      hp: 100,
      combatStats: { ...defaultCombatStats(), agroValue: 10 },
    });

    expect(
      combatGetTargetsFromListBasedOnType(
        [lowEnemy, taunter],
        'MatchingEnemies',
        1,
        { combatant: caster, matchingCombatants: [lowEnemy] },
      ),
    ).toEqual([taunter]);
  });

  it('MatchingAllies ignores agro so heals stay on the matched allies', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const wounded = buildTestCombatant({ id: 'wounded', hp: 5 });
    const tank = buildTestCombatant({
      id: 'tank',
      hp: 100,
      combatStats: { ...defaultCombatStats(), agroValue: 10 },
    });

    expect(
      combatGetTargetsFromListBasedOnType(
        [wounded, tank],
        'MatchingAllies',
        1,
        { combatant: caster, matchingCombatants: [wounded] },
      ),
    ).toEqual([wounded]);
  });

  it("always includes an agro'd combatant in a partial AoE selection, even if hp ordering would exclude them", () => {
    const agroed = buildTestCombatant({
      id: 'agroed',
      hp: 100,
      combatStats: { ...defaultCombatStats(), agroValue: 10 },
    });
    const weakest = buildTestCombatant({ id: 'weakest', hp: 1 });
    const other = buildTestCombatant({ id: 'other', hp: 5 });

    const result = combatGetTargetsFromListBasedOnType(
      [agroed, weakest, other],
      'Weakest',
      2,
    );

    expect(sortBy(result, (c) => c.id)).toEqual([agroed, weakest]);
  });

  it('picks the highest-agro combatant as the sole target for a single-target skill, ignoring hp ordering', () => {
    const lowAgro = buildTestCombatant({
      id: 'low-agro',
      hp: 1,
      combatStats: { ...defaultCombatStats(), agroValue: 10 },
    });
    const highAgro = buildTestCombatant({
      id: 'high-agro',
      hp: 100,
      combatStats: { ...defaultCombatStats(), agroValue: 50 },
    });
    const noAgro = buildTestCombatant({ id: 'no-agro', hp: 1 });

    const result = combatGetTargetsFromListBasedOnType(
      [lowAgro, highAgro, noAgro],
      'Weakest',
      1,
    );

    expect(result).toEqual([highAgro]);
  });
});

describe('combatGetTargetsFromPriorityList', () => {
  it('returns targets from the first entry that resolves a non-empty result', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const healer = buildTestCombatant({
      id: 'healer',
      jobId: 'healer' as JobId,
    });
    const warrior = buildTestCombatant({
      id: 'warrior',
      jobId: 'warrior' as JobId,
    });
    const context: CombatTargetModeContext = { combatant: caster };

    const result = combatGetTargetsFromPriorityList(
      [warrior, healer],
      [{ type: 'Random', jobId: 'healer' as JobId }, { type: 'Random' }],
      1,
      context,
    );

    expect(result).toEqual([healer]);
  });

  it("narrows to jobId before applying the entry's mode, e.g. the weakest combatant of that job rather than the weakest overall", () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const frailHealer = buildTestCombatant({
      id: 'frail-healer',
      hp: 5,
      jobId: 'healer' as JobId,
    });
    const sturdyHealer = buildTestCombatant({
      id: 'sturdy-healer',
      hp: 50,
      jobId: 'healer' as JobId,
    });
    const frailWarrior = buildTestCombatant({
      id: 'frail-warrior',
      hp: 1,
      jobId: 'warrior' as JobId,
    });
    const context: CombatTargetModeContext = { combatant: caster };

    const result = combatGetTargetsFromPriorityList(
      [frailWarrior, sturdyHealer, frailHealer],
      [{ type: 'Weakest', jobId: 'healer' as JobId }],
      1,
      context,
    );

    expect(result).toEqual([frailHealer]);
  });

  it('falls through to the next entry when the first resolves no targets', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const warrior = buildTestCombatant({
      id: 'warrior',
      jobId: 'warrior' as JobId,
    });
    const context: CombatTargetModeContext = { combatant: caster };

    const result = combatGetTargetsFromPriorityList(
      [warrior],
      [{ type: 'Random', jobId: 'healer' as JobId }, { type: 'Random' }],
      1,
      context,
    );

    expect(result).toEqual([warrior]);
  });

  it('returns an empty list when every entry resolves no targets', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const context: CombatTargetModeContext = { combatant: caster };

    const result = combatGetTargetsFromPriorityList(
      [],
      [{ type: 'Random', jobId: 'healer' as JobId }],
      1,
      context,
    );

    expect(result).toEqual([]);
  });
});

describe('combatSkillHasValidTargetsForMode', () => {
  it('treats a town-guardian helper as an ally, alongside heroes', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const helper = buildTestCombatant({ id: 'helper-1', hp: 5 });
    const combat = buildCombat({ heroes: [caster], helpers: [helper] });
    const skill = buildEquipmentSkill({
      techniques: [buildTechnique({ targetType: 'Allies' })],
    });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatSkillHasValidTargetsForMode(combat, caster, skill, 'SpecificHero', {
        ...context,
        targetCharacterId: helper.id as CharacterId,
      }),
    ).toBe(true);
  });

  it('is true when a technique pool can resolve the override mode', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const combat = buildCombat({ heroes: [caster] });
    const skill = buildEquipmentSkill({
      techniques: [buildTechnique({ targetType: 'Self' })],
    });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatSkillHasValidTargetsForMode(combat, caster, skill, 'Self', context),
    ).toBe(true);
  });

  it('treats an effect in its final turn as absent, so a self-buff can be refreshed', () => {
    const caster = buildTestCombatant({
      id: 'caster',
      statusEffects: [
        buildStatusEffect({ id: 'Invigorated' as StatusEffectId, duration: 0 }),
      ],
    });
    const combat = buildCombat({ heroes: [caster] });
    const skill = buildEquipmentSkill({
      techniques: [
        buildTechnique({
          targetType: 'Allies',
          targetBehaviors: [
            {
              behavior: 'IfNotStatusEffect',
              statusEffectId: 'Invigorated' as StatusEffectId,
            },
          ],
        }),
      ],
    });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatSkillHasValidTargetsForMode(combat, caster, skill, 'Self', context),
    ).toBe(true);
  });

  // Mirrors "target self with Fortify, skip if already buffed" via IfNotStatusEffect.
  it('is false when the caster has been filtered out of every technique pool', () => {
    const caster = buildTestCombatant({
      id: 'caster',
      statusEffects: [
        buildStatusEffect({ id: 'Invigorated' as StatusEffectId, duration: 2 }),
      ],
    });
    const combat = buildCombat({ heroes: [caster] });
    const skill = buildEquipmentSkill({
      techniques: [
        buildTechnique({
          targetType: 'Allies',
          targetBehaviors: [
            {
              behavior: 'IfNotStatusEffect',
              statusEffectId: 'Invigorated' as StatusEffectId,
            },
          ],
        }),
      ],
    });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatSkillHasValidTargetsForMode(combat, caster, skill, 'Self', context),
    ).toBe(false);
  });

  it('IfNoSummon filters out a caster whose summon is still alive', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const summon = buildTestCombatant({ id: 'summon', summonerId: 'caster' });
    const combat = buildCombat({ heroes: [caster], helpers: [summon] });
    const skill = buildEquipmentSkill({
      techniques: [
        buildTechnique({
          targetType: 'Self',
          targetBehaviors: [{ behavior: 'IfNoSummon' }],
        }),
      ],
    });
    const context: CombatTargetModeContext = { combatant: caster };
    const hasTarget = () =>
      combatSkillHasValidTargetsForMode(combat, caster, skill, 'Self', context);

    expect(hasTarget()).toBe(false);

    summon.hp = 0;
    expect(hasTarget()).toBe(true);
  });

  it('is false when the only candidate is dead and the technique needs a living target', () => {
    const caster = buildTestCombatant({ id: 'caster', hp: 0 });
    const combat = buildCombat({ heroes: [caster] });
    const skill = buildEquipmentSkill({
      techniques: [
        buildTechnique({ targetBehaviors: [{ behavior: 'NotZeroHealth' }] }),
      ],
    });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatSkillHasValidTargetsForMode(combat, caster, skill, 'Self', context),
    ).toBe(false);
  });

  it('is false for a NotMaxEnergy technique when the caster is at full EP', () => {
    const caster = buildTestCombatant({ id: 'caster', ep: 100 });
    const combat = buildCombat({ heroes: [caster] });
    const skill = buildEquipmentSkill({
      techniques: [
        buildTechnique({ targetBehaviors: [{ behavior: 'NotMaxEnergy' }] }),
      ],
    });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatSkillHasValidTargetsForMode(combat, caster, skill, 'Self', context),
    ).toBe(false);
  });

  it.each([
    ['NotMaxEnergy', 99, true],
    ['ZeroEnergy', 0, true],
    ['ZeroEnergy', 1, false],
    ['NotZeroEnergy', 1, true],
    ['NotZeroEnergy', 0, false],
  ] as const)('%s with %i EP is valid: %s', (behavior, ep, expected) => {
    const caster = buildTestCombatant({ id: 'caster', ep });
    const combat = buildCombat({ heroes: [caster] });
    const skill = buildEquipmentSkill({
      techniques: [buildTechnique({ targetBehaviors: [{ behavior }] })],
    });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatSkillHasValidTargetsForMode(combat, caster, skill, 'Self', context),
    ).toBe(expected);
  });

  it('ignores confusion, which is handled at cast time instead', () => {
    const caster = buildTestCombatant({
      id: 'caster',
      combatStats: {
        ...defaultCombatStats(),
        agroValue: 0,
        redirectionChance: 100,
      },
    });
    const lowEnemy = buildTestCombatant({ id: 'low', isEnemy: true, hp: 5 });
    const combat = buildCombat({ heroes: [caster], guardians: [lowEnemy] });
    const skill = buildEquipmentSkill({
      techniques: [buildTechnique({ targetType: 'Enemies' })],
    });

    expect(
      combatSkillHasValidTargetsForMode(
        combat,
        caster,
        skill,
        'MatchingEnemies',
        { combatant: caster, matchingCombatants: [lowEnemy] },
      ),
    ).toBe(true);
  });

  it('MatchingEnemies with an ally-only skill is false even when an ally is taunting', () => {
    const caster = buildTestCombatant({ id: 'caster' });
    const taunter = buildTestCombatant({
      id: 'taunter',
      hp: 50,
      combatStats: { ...defaultCombatStats(), agroValue: 10 },
    });
    const lowEnemy = buildTestCombatant({ id: 'low', isEnemy: true, hp: 5 });
    const combat = buildCombat({
      heroes: [caster, taunter],
      guardians: [lowEnemy],
    });
    const skill = buildEquipmentSkill({
      techniques: [buildTechnique({ targetType: 'Allies' })],
    });

    expect(
      combatSkillHasValidTargetsForMode(
        combat,
        caster,
        skill,
        'MatchingEnemies',
        { combatant: caster, matchingCombatants: [lowEnemy] },
      ),
    ).toBe(false);
  });
});
