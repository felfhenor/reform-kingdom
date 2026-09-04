import {
  combatAvailableSkillsForCombatant,
  combatGetTargetsFromListBasedOnType,
  combatGetTargetsFromPriorityList,
  combatSkillHasValidTargetsForMode,
} from '@helpers/combat/combat-targetting';
import type {
  Combat,
  Combatant,
  CombatTargetModeContext,
  EquipmentSkill,
  EquipmentSkillContentTechnique,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { describe, expect, it } from 'vitest';

function buildSkill(overrides: Partial<EquipmentSkill> = {}): EquipmentSkill {
  return {
    id: 'skill-1' as never,
    name: 'Test Skill',
    __type: 'skill',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    epCost: 0,
    usesPerCombat: -1,
    statusEffectDurationBoost: {} as never,
    statusEffectChanceBoost: {} as never,
    techniques: [],
    requiredWeaponTypes: [],
    family: 'Test Skill',
    ...overrides,
  };
}

function buildTechnique(
  overrides: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return {
    targets: 1,
    targetType: 'Allies',
    targetBehaviors: [{ behavior: 'Always' }],
    damageScaling: {} as never,
    elements: [],
    attributes: [],
    statusEffects: [],
    combatMessage: '',
    ...overrides,
  };
}

function buildCombat(overrides: Partial<Combat> = {}): Combat {
  return {
    id: 'combat-1' as never,
    locationName: 'Field Ruins',
    locationPosition: { x: 0, y: 0 },
    rounds: 1,
    heroes: [],
    helpers: [],
    guardians: [],
    ...overrides,
  };
}

function buildCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'combatant-1',
    name: 'Combatant',
    isEnemy: false,
    level: 1,
    hp: 10,
    ep: 10,
    sprite: '0000',
    frames: 4,
    targetting: [{ type: 'Random' }],
    baseStats: {} as never,
    statBoosts: {} as never,
    totalStats: {} as never,
    combatStats: { agroValue: 0 } as never,
    resistance: {} as never,
    affinity: {} as never,
    tagResistance: {} as never,
    skillIds: [],
    skillRefs: [],
    skillWeights: {},
    combatOrders: [],
    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
    ...overrides,
  };
}

describe('combatAvailableSkillsForCombatant', () => {
  it('excludes skills whose epCost exceeds the combatant current ep', () => {
    const affordable = buildSkill({ id: 'cheap' as never, epCost: 5 });
    const tooExpensive = buildSkill({ id: 'expensive' as never, epCost: 15 });

    const combatant = buildCombatant({
      ep: 10,
      skillRefs: [affordable, tooExpensive],
    });

    const available = combatAvailableSkillsForCombatant(combatant);

    expect(available.map((s) => s.id)).toEqual(['cheap']);
  });

  it('includes a skill whose epCost exactly matches the combatant current ep', () => {
    const skill = buildSkill({ epCost: 10 });
    const combatant = buildCombatant({ ep: 10, skillRefs: [skill] });

    expect(combatAvailableSkillsForCombatant(combatant)).toEqual([skill]);
  });

  it('still excludes skills that are out of uses even if ep is available', () => {
    const skill = buildSkill({
      id: 'limited' as never,
      epCost: 0,
      usesPerCombat: 1,
    });
    const combatant = buildCombatant({
      ep: 10,
      skillRefs: [skill],
      skillUses: { ['limited' as never]: 1 },
    });

    expect(combatAvailableSkillsForCombatant(combatant)).toEqual([]);
  });
});

describe('combatGetTargetsFromListBasedOnType', () => {
  it('Self returns only the caster from the given list', () => {
    const caster = buildCombatant({ id: 'caster' });
    const ally = buildCombatant({ id: 'ally' });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatGetTargetsFromListBasedOnType([caster, ally], 'Self', 1, context),
    ).toEqual([caster]);
  });

  it('Self returns nothing when the caster is not in the given list', () => {
    const caster = buildCombatant({ id: 'caster' });
    const ally = buildCombatant({ id: 'ally' });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatGetTargetsFromListBasedOnType([ally], 'Self', 1, context),
    ).toEqual([]);
  });

  it('SpecificHero returns only the combatant matching the target character id', () => {
    const target = buildCombatant({ id: 'target-hero' });
    const other = buildCombatant({ id: 'other-hero' });
    const context: CombatTargetModeContext = {
      combatant: other,
      targetCharacterId: 'target-hero' as never,
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
    const other = buildCombatant({ id: 'other-hero' });
    const context: CombatTargetModeContext = {
      combatant: other,
      targetCharacterId: 'missing-hero' as never,
    };

    expect(
      combatGetTargetsFromListBasedOnType([other], 'SpecificHero', 1, context),
    ).toEqual([]);
  });

  it('MatchingAllies only selects from combatants present in both matchingAllies and the pool', () => {
    const caster = buildCombatant({ id: 'caster' });
    const critical = buildCombatant({ id: 'critical', hp: 5 });
    const wounded = buildCombatant({ id: 'wounded', hp: 40 });

    const context: CombatTargetModeContext = {
      combatant: caster,
      matchingAllies: [critical, wounded],
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
    const caster = buildCombatant({ id: 'caster' });
    const critical = buildCombatant({ id: 'critical', hp: 5 });
    const noLongerValid = buildCombatant({ id: 'no-longer-valid', hp: 1 });

    const context: CombatTargetModeContext = {
      combatant: caster,
      matchingAllies: [noLongerValid, critical],
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

  it('always includes an agro\'d combatant in a partial AoE selection, even if hp ordering would exclude them', () => {
    const agroed = buildCombatant({
      id: 'agroed',
      hp: 100,
      combatStats: { agroValue: 10 } as never,
    });
    const weakest = buildCombatant({ id: 'weakest', hp: 1 });
    const other = buildCombatant({ id: 'other', hp: 5 });

    const result = combatGetTargetsFromListBasedOnType(
      [agroed, weakest, other],
      'Weakest',
      2,
    );

    expect(sortBy(result, (c) => c.id)).toEqual([agroed, weakest]);
  });

  it('picks the highest-agro combatant as the sole target for a single-target skill, ignoring hp ordering', () => {
    const lowAgro = buildCombatant({
      id: 'low-agro',
      hp: 1,
      combatStats: { agroValue: 10 } as never,
    });
    const highAgro = buildCombatant({
      id: 'high-agro',
      hp: 100,
      combatStats: { agroValue: 50 } as never,
    });
    const noAgro = buildCombatant({ id: 'no-agro', hp: 1 });

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
    const caster = buildCombatant({ id: 'caster' });
    const healer = buildCombatant({ id: 'healer', jobId: 'healer' as never });
    const warrior = buildCombatant({
      id: 'warrior',
      jobId: 'warrior' as never,
    });
    const context: CombatTargetModeContext = { combatant: caster };

    const result = combatGetTargetsFromPriorityList(
      [warrior, healer],
      [{ type: 'Random', jobId: 'healer' as never }, { type: 'Random' }],
      1,
      context,
    );

    expect(result).toEqual([healer]);
  });

  it("narrows to jobId before applying the entry's mode, e.g. the weakest combatant of that job rather than the weakest overall", () => {
    const caster = buildCombatant({ id: 'caster' });
    const frailHealer = buildCombatant({
      id: 'frail-healer',
      hp: 5,
      jobId: 'healer' as never,
    });
    const sturdyHealer = buildCombatant({
      id: 'sturdy-healer',
      hp: 50,
      jobId: 'healer' as never,
    });
    const frailWarrior = buildCombatant({
      id: 'frail-warrior',
      hp: 1,
      jobId: 'warrior' as never,
    });
    const context: CombatTargetModeContext = { combatant: caster };

    const result = combatGetTargetsFromPriorityList(
      [frailWarrior, sturdyHealer, frailHealer],
      [{ type: 'Weakest', jobId: 'healer' as never }],
      1,
      context,
    );

    expect(result).toEqual([frailHealer]);
  });

  it('falls through to the next entry when the first resolves no targets', () => {
    const caster = buildCombatant({ id: 'caster' });
    const warrior = buildCombatant({
      id: 'warrior',
      jobId: 'warrior' as never,
    });
    const context: CombatTargetModeContext = { combatant: caster };

    const result = combatGetTargetsFromPriorityList(
      [warrior],
      [{ type: 'Random', jobId: 'healer' as never }, { type: 'Random' }],
      1,
      context,
    );

    expect(result).toEqual([warrior]);
  });

  it('returns an empty list when every entry resolves no targets', () => {
    const caster = buildCombatant({ id: 'caster' });
    const context: CombatTargetModeContext = { combatant: caster };

    const result = combatGetTargetsFromPriorityList(
      [],
      [{ type: 'Random', jobId: 'healer' as never }],
      1,
      context,
    );

    expect(result).toEqual([]);
  });
});

describe('combatSkillHasValidTargetsForMode', () => {
  it('treats a town-guardian helper as an ally, alongside heroes', () => {
    const caster = buildCombatant({ id: 'caster' });
    const helper = buildCombatant({ id: 'helper-1', hp: 5 });
    const combat = buildCombat({ heroes: [caster], helpers: [helper] });
    const skill = buildSkill({
      techniques: [buildTechnique({ targetType: 'Allies' })],
    });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatSkillHasValidTargetsForMode(
        combat,
        caster,
        skill,
        'SpecificHero',
        { ...context, targetCharacterId: helper.id },
      ),
    ).toBe(true);
  });

  it('is true when a technique pool can resolve the override mode', () => {
    const caster = buildCombatant({ id: 'caster' });
    const combat = buildCombat({ heroes: [caster] });
    const skill = buildSkill({
      techniques: [buildTechnique({ targetType: 'Self' })],
    });
    const context: CombatTargetModeContext = { combatant: caster };

    expect(
      combatSkillHasValidTargetsForMode(combat, caster, skill, 'Self', context),
    ).toBe(true);
  });

  // Mirrors "target self with Fortify, skip if already buffed" via IfNotStatusEffect.
  it('is false when the caster has been filtered out of every technique pool', () => {
    const caster = buildCombatant({
      id: 'caster',
      statusEffects: [{ id: 'Invigorated' } as never],
    });
    const combat = buildCombat({ heroes: [caster] });
    const skill = buildSkill({
      techniques: [
        buildTechnique({
          targetType: 'Allies',
          targetBehaviors: [
            {
              behavior: 'IfNotStatusEffect',
              statusEffectId: 'Invigorated' as never,
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
});
