import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-combatant-hp', () => ({
  combatantIsDead: vi.fn(() => false),
  combatCombatantTakeDamage: vi.fn(),
}));

vi.mock('@helpers/combat/combat-damage', () => ({
  combatApplySkillToTarget: vi.fn(),
  techniqueHasAttribute: vi.fn(() => false),
}));

vi.mock('@helpers/combat/combat-end', () => ({
  combatCheckIfOver: vi.fn(),
  combatHandleDefeat: vi.fn(),
  isCombatOver: vi.fn(() => false),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  beginCombatLogCommits: vi.fn(),
  combatantMessageToken: vi.fn(() => 'token'),
  combatMessageLog: vi.fn(),
  endCombatLogCommits: vi.fn(),
}));

vi.mock('@helpers/combat/combat-order-evaluation', () => ({
  pickSkillFromCombatOrders: vi.fn(),
}));

vi.mock('@helpers/combat/combat-statuseffects', () => ({
  combatCanTakeTurn: vi.fn(() => true),
  combatExpireCombatantStatusEffects: vi.fn(),
  combatTickCombatantStatusEffects: vi.fn(),
  combatUnapplyAllStatusEffects: vi.fn(),
}));

vi.mock('@helpers/combat/combat-stats', () => ({
  combatCombatantCombatStatSucceedsChance: vi.fn(() => false),
}));

vi.mock('@helpers/combat/combat-targetting', () => ({
  combatAvailableSkillsForCombatant: vi.fn(),
  combatGetPossibleCombatantTargetsForSkill: vi.fn(() => [{ id: 'target' }]),
  combatGetPossibleCombatantTargetsForSkillTechnique: vi.fn(() => []),
  combatGetTargetsFromPriorityList: vi.fn(() => []),
}));

vi.mock('@helpers/rng', () => ({
  rngChoiceWeighted: vi.fn(),
  rngSucceedsChance: vi.fn(() => false),
  rngUuid: vi.fn(() => 'uuid'),
}));

vi.mock('@helpers/hero/skill', () => ({
  skillEpCost: vi.fn(() => 0),
  skillTechniqueNumTargets: vi.fn(() => 1),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
  worldCombatState: vi.fn(),
}));

import {
  combatDoCombatIteration,
  combatantTakeTurn,
} from '@helpers/combat/combat';
import { combatantIsDead } from '@helpers/combat/combat-combatant-hp';
import { combatApplySkillToTarget } from '@helpers/combat/combat-damage';
import { combatantDamageEvents } from '@helpers/combat/combat-damage-events';
import { pickSkillFromCombatOrders } from '@helpers/combat/combat-order-evaluation';
import { combatCombatantCombatStatSucceedsChance } from '@helpers/combat/combat-stats';
import { combatantSkillCastEvents } from '@helpers/combat/combat-skill-events';
import {
  combatCanTakeTurn,
  combatExpireCombatantStatusEffects,
  combatTickCombatantStatusEffects,
} from '@helpers/combat/combat-statuseffects';
import {
  combatAvailableSkillsForCombatant,
  combatGetPossibleCombatantTargetsForSkillTechnique,
  combatGetTargetsFromPriorityList,
} from '@helpers/combat/combat-targetting';
import { rngChoiceWeighted } from '@helpers/rng';
import { updateGamestate, worldCombatState } from '@helpers/state-game';
import { sortBy } from 'es-toolkit/compat';
import type {
  Combat,
  Combatant,
  CombatOrderClauseId,
  EquipmentSkill,
  GameState,
} from '@interfaces';

function buildCombat(): Combat {
  return {
    id: 'combat-1' as never,
    locationName: 'Field Ruins',
    locationPosition: { x: 0, y: 0 },
    rounds: 1,
    heroes: [],
    helpers: [],
    guardians: [],
  };
}

function buildCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'combatant-1',
    name: 'Combatant',
    isEnemy: false,
    level: 1,
    hp: 100,
    ep: 10,
    sprite: '0000',
    frames: 4,
    targetting: [{ type: 'Random' }],
    baseStats: {} as never,
    statBoosts: {} as never,
    totalStats: { Health: 100, Energy: 10 } as never,
    combatStats: {} as never,
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

beforeEach(() => {
  vi.clearAllMocks();
  combatantSkillCastEvents.set([]);
});

describe('combatDoCombatIteration', () => {
  function commitRound(previous: Combat): Combat | undefined {
    vi.mocked(worldCombatState).mockReturnValue(previous);
    combatDoCombatIteration();

    const state = { world: { combat: previous } } as unknown as GameState;
    return vi.mocked(updateGamestate).mock.calls[0][0](state).world.combat;
  }

  it('commits a new top-level Combat reference each round so worldCombatState consumers update', () => {
    const previous = buildCombat();

    const committed = commitRound(previous);

    expect(committed).not.toBe(previous);
    expect(committed?.rounds).toBe(2);
    expect(previous.rounds).toBe(1);
  });

  it('plays the round on a copy, leaving the previous round untouched', () => {
    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([]);
    const previous = {
      ...buildCombat(),
      heroes: [buildCombatant()],
    };
    const snapshot = structuredClone(previous);

    const committed = commitRound(previous);

    expect(committed?.heroes[0]).not.toBe(previous.heroes[0]);
    expect(previous).toEqual(snapshot);
  });

  it('does not start a round when there is no combat', () => {
    vi.mocked(worldCombatState).mockReturnValue(undefined);

    combatDoCombatIteration();

    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('combatantTakeTurn skill selection', () => {
  it('emits a skill-cast event for the chosen skill', () => {
    const weightedSkill = buildSkill({
      id: 'weighted' as never,
      name: 'Fireball',
      sprite: '0042',
    });

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      weightedSkill,
    ]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(weightedSkill);

    const combatant = buildCombatant({ id: 'caster-1', combatOrders: [] });

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatantSkillCastEvents()).toMatchObject([
      { combatantId: 'caster-1', skillName: 'Fireball', skillSprite: '0042' },
    ]);
  });

  it('uses the Combat Orders pick when the hero has configured orders', () => {
    const orderedSkill = buildSkill({
      id: 'ordered' as never,
      family: 'Fireball',
    });
    const weightedSkill = buildSkill({ id: 'weighted' as never });

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      orderedSkill,
      weightedSkill,
    ]);
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: orderedSkill,
    });
    vi.mocked(rngChoiceWeighted).mockReturnValue(weightedSkill);

    const combatant = buildCombatant({
      combatOrders: [
        {
          id: 'clause-1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatant.skillUses['ordered' as never]).toBe(1);
    expect(combatant.skillUses['weighted' as never]).toBeUndefined();
  });

  it('falls back to weighted-random and never consults Combat Orders when none are configured', () => {
    const weightedSkill = buildSkill({ id: 'weighted' as never });

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      weightedSkill,
    ]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(weightedSkill);

    const combatant = buildCombatant({ combatOrders: [] });

    combatantTakeTurn(buildCombat(), combatant);

    expect(pickSkillFromCombatOrders).not.toHaveBeenCalled();
    expect(combatant.skillUses['weighted' as never]).toBe(1);
  });

  it('enemies always use weighted-random, even if combatOrders were somehow populated', () => {
    const weightedSkill = buildSkill({ id: 'weighted' as never });
    const orderedSkill = buildSkill({ id: 'ordered' as never });

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      weightedSkill,
    ]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(weightedSkill);
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: orderedSkill,
    });

    const combatant = buildCombatant({
      isEnemy: true,
      combatOrders: [
        {
          id: 'clause-1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'RandomSkill' },
        },
      ],
    });

    combatantTakeTurn(buildCombat(), combatant);

    expect(pickSkillFromCombatOrders).not.toHaveBeenCalled();
    expect(combatant.skillUses['weighted' as never]).toBe(1);
  });
});

describe('combatantTakeTurn targeting', () => {
  function buildTargetingSkill() {
    return buildSkill({
      id: 'weighted' as never,
      techniques: [
        {
          targets: 1,
          targetType: 'Enemies',
          targetBehaviors: [{ behavior: 'Always' }],
          damageScaling: {} as never,
          elements: [],
          attributes: [],
          statusEffects: [],
          combatMessage: '',
        },
      ],
    });
  }

  it('resolves targets from the combatant own targetting priority list when no Combat Order override applies', () => {
    const weightedSkill = buildTargetingSkill();

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      weightedSkill,
    ]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(weightedSkill);

    const baseList = [{ id: 'target' } as never];
    vi.mocked(
      combatGetPossibleCombatantTargetsForSkillTechnique,
    ).mockReturnValue(baseList);

    const priority = [
      { type: 'Random' as const, jobId: 'healer' as never },
      { type: 'Random' as const },
    ];
    const combatant = buildCombatant({ targetting: priority });

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatGetTargetsFromPriorityList).toHaveBeenCalledWith(
      baseList,
      priority,
      1,
      expect.anything(),
    );
  });

  it("wraps a Combat Order's targetMode override into a single-entry priority list, taking precedence over the combatant's own list", () => {
    const orderedSkill = buildTargetingSkill();

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      orderedSkill,
    ]);
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: orderedSkill,
      targetMode: 'Weakest',
    });

    const baseList = [{ id: 'target' } as never];
    vi.mocked(
      combatGetPossibleCombatantTargetsForSkillTechnique,
    ).mockReturnValue(baseList);

    const combatant = buildCombatant({
      targetting: [{ type: 'Random', jobId: 'healer' as never }],
      combatOrders: [
        {
          id: 'clause-1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatGetTargetsFromPriorityList).toHaveBeenCalledWith(
      baseList,
      [{ type: 'Weakest' }],
      1,
      expect.anything(),
    );
  });

  it("drops a Combat Order's targetMode override when confusion redirects the technique", () => {
    const orderedSkill = buildTargetingSkill();

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      orderedSkill,
    ]);
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: orderedSkill,
      targetMode: 'MatchingEnemies',
    });
    vi.mocked(combatCombatantCombatStatSucceedsChance).mockImplementation(
      (_combatant, stat) => stat === 'redirectionChance',
    );

    const baseList = [{ id: 'target' } as never];
    vi.mocked(
      combatGetPossibleCombatantTargetsForSkillTechnique,
    ).mockReturnValue(baseList);

    const priority = [{ type: 'Weakest' as const }];
    const combatant = buildCombatant({
      targetting: priority,
      combatOrders: [
        {
          id: 'clause-1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    combatantTakeTurn(buildCombat(), combatant);

    vi.mocked(combatCombatantCombatStatSucceedsChance).mockImplementation(
      () => false,
    );

    expect(
      combatGetPossibleCombatantTargetsForSkillTechnique,
    ).toHaveBeenCalledWith(
      expect.anything(),
      combatant,
      orderedSkill,
      expect.anything(),
      true,
    );
    expect(combatGetTargetsFromPriorityList).toHaveBeenCalledWith(
      baseList,
      priority,
      1,
      expect.anything(),
    );
  });

  it('emits a miss event on the target and skips the technique when the missChance roll succeeds', () => {
    const skill = buildTargetingSkill();
    const target = buildCombatant({ id: 'target-1' });

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([skill]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(skill);
    vi.mocked(combatGetTargetsFromPriorityList).mockReturnValueOnce([target]);
    vi.mocked(combatCombatantCombatStatSucceedsChance).mockImplementation(
      (_combatant, stat) => stat === 'missChance',
    );
    combatantDamageEvents.set([]);

    combatantTakeTurn(buildCombat(), buildCombatant());

    vi.mocked(combatCombatantCombatStatSucceedsChance).mockImplementation(
      () => false,
    );

    expect(combatApplySkillToTarget).not.toHaveBeenCalled();
    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: 'target-1', amount: 0, variant: 'miss' },
    ]);
  });
});

describe('combatantTakeTurn status effect timing', () => {
  function callOrder(): string[] {
    const calls = [
      ...vi
        .mocked(combatTickCombatantStatusEffects)
        .mock.calls.map((call, i) => ({
          name: `tick:${call[2]}`,
          order: vi.mocked(combatTickCombatantStatusEffects).mock
            .invocationCallOrder[i],
        })),
      ...vi
        .mocked(combatCombatantCombatStatSucceedsChance)
        .mock.calls.map((call, i) => ({
          name: `roll:${call[1]}`,
          order: vi.mocked(combatCombatantCombatStatSucceedsChance).mock
            .invocationCallOrder[i],
        })),
      ...vi
        .mocked(combatExpireCombatantStatusEffects)
        .mock.calls.map((_, i) => ({
          name: 'expire',
          order: vi.mocked(combatExpireCombatantStatusEffects).mock
            .invocationCallOrder[i],
        })),
    ];
    return sortBy(calls, (c) => c.order).map((c) => c.name);
  }

  it('expires effects only after the stun roll, so a final-turn stun still lands', () => {
    vi.mocked(combatCombatantCombatStatSucceedsChance).mockReturnValueOnce(
      true,
    );

    combatantTakeTurn(buildCombat(), buildCombatant());

    expect(callOrder()).toEqual([
      'tick:TurnStart',
      'roll:stunChance',
      'tick:TurnEnd',
      'expire',
    ]);
  });

  it('still ticks TurnEnd effects when frozen, without rolling for an extra turn', () => {
    vi.mocked(combatCanTakeTurn).mockReturnValueOnce(false);

    const result = combatantTakeTurn(buildCombat(), buildCombatant());

    expect(callOrder()).toEqual(['tick:TurnStart', 'tick:TurnEnd', 'expire']);
    expect(result).toEqual({});
  });

  it('still ticks TurnEnd effects when no skill can be chosen', () => {
    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);

    combatantTakeTurn(buildCombat(), buildCombatant());

    expect(callOrder()).toEqual([
      'tick:TurnStart',
      'roll:stunChance',
      'tick:TurnEnd',
      'expire',
    ]);
  });

  it('skips TurnEnd and expiry when the TurnStart tick kills the combatant', () => {
    vi.mocked(combatantIsDead)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    combatantTakeTurn(buildCombat(), buildCombatant());

    expect(callOrder()).toEqual(['tick:TurnStart']);
  });

  it('does not roll for an extra turn when the TurnEnd tick kills the combatant', () => {
    const skill = buildSkill();
    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([skill]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(skill);
    vi.mocked(combatantIsDead)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    combatantTakeTurn(buildCombat(), buildCombatant());

    expect(callOrder()).toEqual([
      'tick:TurnStart',
      'roll:stunChance',
      'tick:TurnEnd',
      'expire',
    ]);
  });
});
