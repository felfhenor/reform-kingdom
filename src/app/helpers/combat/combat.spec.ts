import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-combatant-hp');
vi.mock('@helpers/combat/combat-damage');
vi.mock('@helpers/combat/combat-end');
vi.mock('@helpers/combat/combat-order-evaluation');
vi.mock('@helpers/combat/combat-statuseffects');
vi.mock('@helpers/combat/combat-stats');
vi.mock('@helpers/combat/combat-targetting');
vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngChoiceWeighted: vi.fn(),
  rngSucceedsChance: vi.fn(() => false),
}));

import {
  combatDoCombatIteration,
  combatantTakeTurn,
} from '@helpers/combat/combat';
import {
  combatantIsDead,
  combatCombatantTakeDamage,
} from '@helpers/combat/combat-combatant-hp';
import {
  combatApplySkillToTarget,
  techniqueHasAttribute,
} from '@helpers/combat/combat-damage';
import { combatantDamageEvents } from '@helpers/combat/combat-damage-events';
import { pickSkillFromCombatOrders } from '@helpers/combat/combat-order-evaluation';
import { combatantSkillCastEvents } from '@helpers/combat/combat-skill-events';
import { combatCombatantCombatStatSucceedsChance } from '@helpers/combat/combat-stats';
import {
  combatCanTakeTurn,
  combatExpireCombatantStatusEffects,
  combatTickCombatantStatusEffects,
  combatUnapplyAllStatusEffects,
} from '@helpers/combat/combat-statuseffects';
import {
  combatAvailableSkillsForCombatant,
  combatGetPossibleCombatantTargetsForSkill,
  combatGetPossibleCombatantTargetsForSkillTechnique,
  combatGetTargetsFromPriorityList,
} from '@helpers/combat/combat-targetting';
import { ensureMonster } from '@helpers/content/ensure-monster';
import {
  ensureEquipmentSkillTechnique,
  ensureSkill,
} from '@helpers/content/ensure-skill';
import { defaultStats } from '@helpers/defaults';
import { rngChoiceWeighted, rngSucceedsChance } from '@helpers/rng';
import { gamestate, worldCombatState } from '@helpers/state-game';
import type {
  Combatant,
  CombatOrderClause,
  CombatOrderClauseId,
  CombatStat,
  EquipmentSkill,
  EquipmentSkillContentTechnique,
  EquipmentSkillId,
  JobId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { buildCombat, buildMonsterCombatant } from '@/testing/builders';
import { inTick, seedGamestate } from '@/testing/gamestate';

const target = buildMonsterCombatant(ensureMonster({ name: 'Target' }), {
  id: 'target-1',
});

const castFireball: CombatOrderClause = {
  id: 'clause-1' as CombatOrderClauseId,
  enabled: true,
  condition: { type: 'Always' },
  action: { type: 'CastSkillFamily', family: 'Fireball' },
};

function skill(id: string, overrides: Partial<EquipmentSkill> = {}) {
  return ensureSkill({
    id: id as EquipmentSkillId,
    name: id,
    techniques: [{ targets: 1 } as EquipmentSkillContentTechnique],
    ...overrides,
  });
}

// Built from a monster: a hero combatant would route through the automocked combat-stats and come out without combatStats.
function caster(overrides: Partial<Combatant> = {}): Combatant {
  const monster = ensureMonster({
    name: 'Caster',
    baseStats: { ...defaultStats(), Health: 40, Energy: 15 },
  });
  return buildMonsterCombatant(monster, {
    id: 'caster-1',
    isEnemy: false,
    ...overrides,
  });
}

function available(...skills: EquipmentSkill[]): void {
  vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue(skills);
}

function rollsSucceed(...stats: CombatStat[]): void {
  vi.mocked(combatCombatantCombatStatSucceedsChance).mockImplementation(
    (_combatant, stat) => stats.includes(stat),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(combatantIsDead).mockReturnValue(false);
  vi.mocked(combatCanTakeTurn).mockReturnValue(true);
  vi.mocked(rngSucceedsChance).mockReturnValue(false);
  vi.mocked(combatCombatantCombatStatSucceedsChance).mockReturnValue(false);
  vi.mocked(techniqueHasAttribute).mockReturnValue(false);
  vi.mocked(combatGetPossibleCombatantTargetsForSkill).mockReturnValue([
    target,
  ]);
  vi.mocked(combatGetPossibleCombatantTargetsForSkillTechnique).mockReturnValue(
    [target],
  );
  vi.mocked(combatGetTargetsFromPriorityList).mockReturnValue([]);
  vi.mocked(pickSkillFromCombatOrders).mockReturnValue(undefined);
  available();
  vi.mocked(rngChoiceWeighted).mockImplementation((skills) => skills[0]);
  combatantSkillCastEvents.set([]);
  combatantDamageEvents.set([]);
});

describe('combatDoCombatIteration', () => {
  it('commits the round on a copy, leaving the previous round untouched', () => {
    const previous = buildCombat({ rounds: 1, heroes: [caster()] });
    const snapshot = structuredClone(previous);
    seedGamestate((state) => (state.world.combat = previous));

    inTick(combatDoCombatIteration);

    const committed = worldCombatState();
    expect(committed).not.toBe(previous);
    expect(committed?.rounds).toBe(2);
    expect(committed?.heroes[0]).not.toBe(previous.heroes[0]);
    expect(previous).toEqual(snapshot);
  });

  it('does nothing when there is no combat', () => {
    const before = seedGamestate();

    inTick(combatDoCombatIteration);

    expect(gamestate()).toBe(before);
  });
});

describe('combatantTakeTurn when dead', () => {
  beforeEach(() => vi.mocked(combatantIsDead).mockReturnValueOnce(true));

  it('skips the turn entirely without a revive', () => {
    vi.mocked(rngSucceedsChance).mockReturnValue(false);

    expect(combatantTakeTurn(buildCombat(), caster())).toEqual({});
    expect(combatTickCombatantStatusEffects).not.toHaveBeenCalled();
  });

  it('revives to full health, clearing status effects, and then takes the turn', () => {
    vi.mocked(rngSucceedsChance).mockReturnValue(true);
    const combatant = caster({ hp: 0 });

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatCombatantTakeDamage).toHaveBeenCalledWith(
      combatant,
      -combatant.totalStats.Health,
    );
    expect(combatUnapplyAllStatusEffects).toHaveBeenCalled();
    expect(combatTickCombatantStatusEffects).toHaveBeenCalled();
  });
});

describe('combatantTakeTurn skill selection', () => {
  it('spends the chosen skill and emits a cast event for it', () => {
    available(skill('fireball', { name: 'Fireball', sprite: '0042' }));
    const combatant = caster();

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatant.skillUses['fireball' as EquipmentSkillId]).toBe(1);
    expect(combatantSkillCastEvents()).toMatchObject([
      { combatantId: 'caster-1', skillName: 'Fireball', skillSprite: '0042' },
    ]);
  });

  it('uses the Combat Orders pick when the hero has configured orders', () => {
    const ordered = skill('ordered');
    available(skill('weighted'), ordered);
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({ skill: ordered });
    const combatant = caster({ combatOrders: [castFireball] });

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatant.skillUses).toEqual({ ordered: 1 });
  });

  it('falls back to weighted-random without consulting orders when none are configured, or for enemies', () => {
    available(skill('weighted'));
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: skill('ordered'),
    });
    const hero = caster();
    const enemy = caster({ isEnemy: true, combatOrders: [castFireball] });

    combatantTakeTurn(buildCombat(), hero);
    combatantTakeTurn(buildCombat(), enemy);

    expect(pickSkillFromCombatOrders).not.toHaveBeenCalled();
    expect(hero.skillUses).toEqual({ weighted: 1 });
    expect(enemy.skillUses).toEqual({ weighted: 1 });
  });

  it('only weighs skills that have a possible target', () => {
    const targetless = skill('targetless');
    available(targetless, skill('targeted'));
    vi.mocked(combatGetPossibleCombatantTargetsForSkill).mockImplementation(
      (_combat, _combatant, candidate) =>
        candidate.id === targetless.id ? [] : [target],
    );

    combatantTakeTurn(buildCombat(), caster());

    expect(vi.mocked(rngChoiceWeighted).mock.calls[0][0]).toEqual([
      skill('targeted'),
    ]);
  });
});

describe('combatantTakeTurn targeting', () => {
  function targetPriorityUsed() {
    return vi.mocked(combatGetTargetsFromPriorityList).mock.calls[0][1];
  }

  it("targets by the combatant's own priority list without an order override", () => {
    available(skill('weighted'));
    const priority = [
      { type: 'Random' as const, jobId: 'healer' as JobId },
      { type: 'Random' as const },
    ];

    combatantTakeTurn(buildCombat(), caster({ targetting: priority }));

    expect(targetPriorityUsed()).toEqual(priority);
  });

  it("lets a Combat Order's targetMode override the combatant's own list", () => {
    const ordered = skill('ordered');
    available(ordered);
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: ordered,
      targetMode: 'Weakest',
    });

    combatantTakeTurn(
      buildCombat(),
      caster({
        targetting: [{ type: 'Random' }],
        combatOrders: [castFireball],
      }),
    );

    expect(targetPriorityUsed()).toEqual([{ type: 'Weakest' }]);
  });

  it("drops the order's targetMode override when confusion redirects the technique", () => {
    const ordered = skill('ordered');
    available(ordered);
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: ordered,
      targetMode: 'MatchingEnemies',
    });
    rollsSucceed('redirectionChance');
    const priority = [{ type: 'Weakest' as const }];
    const combatant = caster({
      targetting: priority,
      combatOrders: [castFireball],
    });

    combatantTakeTurn(buildCombat(), combatant);

    expect(
      vi.mocked(combatGetPossibleCombatantTargetsForSkillTechnique).mock
        .calls[0][4],
    ).toBe(true);
    expect(targetPriorityUsed()).toEqual(priority);
  });

  it('emits a miss on the target instead of applying the technique when the miss roll succeeds', () => {
    available(skill('weighted'));
    vi.mocked(combatGetTargetsFromPriorityList).mockReturnValue([target]);
    rollsSucceed('missChance');

    combatantTakeTurn(buildCombat(), caster());

    expect(combatApplySkillToTarget).not.toHaveBeenCalled();
    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: 'target-1', amount: 0, variant: 'miss' },
    ]);
  });

  it('ignores the miss roll for a NeverMisses technique', () => {
    available(skill('weighted'));
    vi.mocked(combatGetTargetsFromPriorityList).mockReturnValue([target]);
    vi.mocked(techniqueHasAttribute).mockImplementation(
      (_tech, attribute) => attribute === 'NeverMisses',
    );
    rollsSucceed('missChance');

    combatantTakeTurn(buildCombat(), caster());

    expect(combatApplySkillToTarget).toHaveBeenCalledOnce();
  });

  it('misses when a below-100 accuracy roll fails, and hits when it succeeds', () => {
    const inaccurate = skill('inaccurate', {
      techniques: [ensureEquipmentSkillTechnique({ accuracy: 70 })],
    });
    available(inaccurate);
    vi.mocked(combatGetTargetsFromPriorityList).mockReturnValue([target]);

    combatantTakeTurn(buildCombat(), caster());
    expect(combatApplySkillToTarget).not.toHaveBeenCalled();
    expect(rngSucceedsChance).toHaveBeenCalledWith(70);

    vi.mocked(rngSucceedsChance).mockReturnValue(true);
    combatantTakeTurn(buildCombat(), caster());
    expect(combatApplySkillToTarget).toHaveBeenCalledOnce();
  });

  it('skips the accuracy roll entirely at 100 accuracy', () => {
    available(skill('weighted'));
    vi.mocked(combatGetTargetsFromPriorityList).mockReturnValue([target]);

    combatantTakeTurn(buildCombat(), caster());

    expect(rngSucceedsChance).not.toHaveBeenCalled();
    expect(combatApplySkillToTarget).toHaveBeenCalledOnce();
  });

  it('applies the technique twice when the strike-again roll succeeds', () => {
    available(skill('weighted'));
    vi.mocked(combatGetTargetsFromPriorityList).mockReturnValue([target]);
    rollsSucceed('skillStrikeAgainChance');

    combatantTakeTurn(buildCombat(), caster());

    expect(combatApplySkillToTarget).toHaveBeenCalledTimes(2);
  });
});

describe('combatantTakeTurn status effect timing', () => {
  function callOrder(): string[] {
    const tick = vi.mocked(combatTickCombatantStatusEffects).mock;
    const roll = vi.mocked(combatCombatantCombatStatSucceedsChance).mock;
    const expire = vi.mocked(combatExpireCombatantStatusEffects).mock;
    const calls = [
      ...tick.calls.map((call, i) => ({
        name: `tick:${call[2]}`,
        order: tick.invocationCallOrder[i],
      })),
      ...roll.calls.map((call, i) => ({
        name: `roll:${call[1]}`,
        order: roll.invocationCallOrder[i],
      })),
      ...expire.calls.map((_, i) => ({
        name: 'expire',
        order: expire.invocationCallOrder[i],
      })),
    ];
    return sortBy(calls, (c) => c.order).map((c) => c.name);
  }

  it('expires effects only after the stun roll, so a final-turn stun still lands', () => {
    available(skill('weighted'));
    rollsSucceed('stunChance');
    const combatant = caster();

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatant.skillUses).toEqual({});
    expect(callOrder()).toEqual([
      'tick:TurnStart',
      'roll:stunChance',
      'tick:TurnEnd',
      'expire',
    ]);
  });

  it('still ticks TurnEnd effects when frozen, without rolling for an extra turn', () => {
    vi.mocked(combatCanTakeTurn).mockReturnValue(false);

    expect(combatantTakeTurn(buildCombat(), caster())).toEqual({});
    expect(callOrder()).toEqual(['tick:TurnStart', 'tick:TurnEnd', 'expire']);
  });

  it('still ticks TurnEnd effects when no skill can be chosen', () => {
    combatantTakeTurn(buildCombat(), caster());

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

    combatantTakeTurn(buildCombat(), caster());

    expect(callOrder()).toEqual(['tick:TurnStart']);
  });

  it('does not roll for an extra turn when the TurnEnd tick kills the combatant', () => {
    available(skill('weighted'));
    vi.mocked(combatantIsDead)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    combatantTakeTurn(buildCombat(), caster());

    expect(callOrder()).toEqual([
      'tick:TurnStart',
      'roll:stunChance',
      'roll:redirectionChance',
      'tick:TurnEnd',
      'expire',
    ]);
  });

  it('grants another turn when the repeat-action roll succeeds after acting', () => {
    available(skill('weighted'));
    rollsSucceed('repeatActionChance');

    expect(combatantTakeTurn(buildCombat(), caster())).toEqual({
      takeAnotherTurn: true,
    });
  });
});

describe('combatantTakeTurn delayed skills', () => {
  const charged = skill('charged', { name: 'Charged Strike', delay: 2 });

  beforeEach(() => {
    vi.mocked(combatGetTargetsFromPriorityList).mockReturnValue([target]);
  });

  function castThenIdle(combatant: Combatant, idleTurns: number): void {
    available(charged);
    combatantTakeTurn(buildCombat(), combatant);
    available();
    for (let i = 0; i < idleTurns; i++) {
      combatantTakeTurn(buildCombat(), combatant);
    }
  }

  it('spends the skill on cast but only queues it', () => {
    const combatant = caster();

    castThenIdle(combatant, 0);

    expect(combatant.skillUses['charged' as EquipmentSkillId]).toBe(1);
    expect(combatant.delayedSkills).toEqual([
      { skill: charged, turnsRemaining: 2 },
    ]);
    expect(combatApplySkillToTarget).not.toHaveBeenCalled();
  });

  it("fires at the start of the caster's delay-th turn, before TurnStart effects", () => {
    const combatant = caster();

    castThenIdle(combatant, 1);
    expect(combatApplySkillToTarget).not.toHaveBeenCalled();

    vi.mocked(combatTickCombatantStatusEffects).mockClear();
    combatantTakeTurn(buildCombat(), combatant);

    expect(combatApplySkillToTarget).toHaveBeenCalledOnce();
    expect(
      vi.mocked(combatApplySkillToTarget).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(combatTickCombatantStatusEffects).mock.invocationCallOrder[0],
    );
    expect(combatant.delayedSkills).toEqual([]);
  });

  it('fires even when the caster then loses their turn', () => {
    const combatant = caster();
    castThenIdle(combatant, 1);
    vi.mocked(combatCanTakeTurn).mockReturnValue(false);

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatApplySkillToTarget).toHaveBeenCalledOnce();
  });

  it("keeps the cast's Combat Order target override for when it fires", () => {
    const combatant = caster({ combatOrders: [castFireball] });
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: charged,
      targetMode: 'Weakest',
    });
    castThenIdle(combatant, 1);
    vi.mocked(combatGetTargetsFromPriorityList).mockClear();

    combatantTakeTurn(buildCombat(), combatant);

    expect(
      vi.mocked(combatGetTargetsFromPriorityList).mock.calls[0][1],
    ).toEqual([{ type: 'Weakest' }]);
  });

  it('stops a ready batch and ends the turn once the caster dies mid-batch', () => {
    const combatant = caster();
    available(charged);
    combatantTakeTurn(buildCombat(), combatant);
    combatantTakeTurn(buildCombat(), combatant);
    combatant.delayedSkills?.forEach((entry) => (entry.turnsRemaining = 1));
    vi.mocked(combatApplySkillToTarget).mockImplementationOnce(() =>
      vi.mocked(combatantIsDead).mockReturnValue(true),
    );
    vi.mocked(combatTickCombatantStatusEffects).mockClear();

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatApplySkillToTarget).toHaveBeenCalledOnce();
    expect(combatTickCombatantStatusEffects).not.toHaveBeenCalled();
  });

  it('keeps overlapping casts as separate delays', () => {
    const combatant = caster();
    available(charged);

    combatantTakeTurn(buildCombat(), combatant);
    combatantTakeTurn(buildCombat(), combatant);
    expect(combatant.delayedSkills).toHaveLength(2);

    available();
    combatantTakeTurn(buildCombat(), combatant);
    expect(combatApplySkillToTarget).toHaveBeenCalledOnce();

    combatantTakeTurn(buildCombat(), combatant);
    expect(combatApplySkillToTarget).toHaveBeenCalledTimes(2);
  });
});
