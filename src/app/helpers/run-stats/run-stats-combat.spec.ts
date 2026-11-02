import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return {
    ...actual,
    rngSucceedsChance: vi.fn().mockReturnValue(false),
    rngUniform: vi.fn().mockReturnValue(1),
  };
});

import { combatApplySkillToTarget } from '@helpers/combat/combat-damage';
import { combatTickCombatantStatusEffects } from '@helpers/combat/combat-statuseffects';
import { ensureStatusEffect } from '@helpers/content/ensure-statuseffect';
import { rngSucceedsChance } from '@helpers/rng';
import { seedContent } from '@/testing/content';
import { ensureEquipmentSkillTechnique } from '@helpers/content/ensure-skill';
import { defaultHeroRunStats, defaultStats } from '@helpers/defaults';
import {
  runStatsCombatBegin,
  runStatsCombatFlush,
  runStatsCreditHeroId,
  runStatsMergeHero,
  runStatsRecordHit,
} from '@helpers/run-stats/run-stats-combat';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CharacterId,
  Combat,
  Combatant,
  HeroRunStats,
  StatusEffectId,
} from '@interfaces';
import {
  buildCombat,
  buildEquipmentSkill,
  buildTestCombatant,
} from '@/testing/builders';
import { inTick, seedGamestate } from '@/testing/gamestate';

const heroId = 'hero-1' as CharacterId;

function combatant(overrides: Partial<Combatant>): Combatant {
  return buildTestCombatant({ name: overrides.id, ...overrides });
}

function setup(): {
  combat: Combat;
  hero: Combatant;
  summon: Combatant;
  enemy: Combatant;
  enemySummon: Combatant;
  guardian: Combatant;
} {
  const hero = combatant({ id: heroId });
  const summon = combatant({ id: 'summon-1', summonerId: heroId });
  const enemy = combatant({ id: 'enemy-1', isEnemy: true });
  const enemySummon = combatant({
    id: 'enemy-summon',
    isEnemy: true,
    summonerId: 'enemy-1',
  });
  const guardian = combatant({ id: 'town-guard' });
  const combat = buildCombat({
    heroes: [hero],
    helpers: [summon, guardian],
    guardians: [enemy, enemySummon],
  });
  return { combat, hero, summon, enemy, enemySummon, guardian };
}

function flushed(): HeroRunStats | undefined {
  seedGamestate();
  inTick(() =>
    updateGamestate((state) => {
      runStatsCombatFlush(state);
      return state;
    }),
  );
  return gamestate().runStats.heroes[heroId];
}

const hit = (hpDelta: number, extra = {}) => ({
  change: { hpDelta, absorbed: 0, died: false, ...extra },
});

beforeEach(() => {
  runStatsCombatBegin();
  vi.mocked(rngSucceedsChance).mockReset().mockReturnValue(false);
});

describe('runStatsCreditHeroId', () => {
  it('credits a hero and its summons, and nobody else', () => {
    const { combat, hero, summon, enemy, enemySummon, guardian } = setup();

    expect(runStatsCreditHeroId(combat, hero)).toBe(heroId);
    expect(runStatsCreditHeroId(combat, summon)).toBe(heroId);
    expect(runStatsCreditHeroId(combat, enemy)).toBeUndefined();
    expect(runStatsCreditHeroId(combat, enemySummon)).toBeUndefined();
    expect(runStatsCreditHeroId(combat, guardian)).toBeUndefined();
  });
});

describe('runStatsRecordHit', () => {
  it('credits damage, crits, the biggest hit and kills to the attacker', () => {
    const { combat, summon, enemy, enemySummon } = setup();

    runStatsRecordHit(combat, summon, enemy, {
      ...hit(30, { died: true }),
      skillFamily: 'Fire',
      isCriticalHit: true,
    });
    runStatsRecordHit(combat, summon, enemySummon, hit(5, { died: true }));

    expect(flushed()).toMatchObject({
      damageDealt: 35,
      crits: 1,
      kills: 1,
      biggestHit: { amount: 30, skillFamily: 'Fire' },
    });
  });

  it("counts a hero's damage taken, blocked and deaths, but never a summon's", () => {
    const { combat, hero, summon, enemy } = setup();

    runStatsRecordHit(combat, enemy, hero, {
      ...hit(20, { absorbed: 5, died: true }),
      prevented: 3,
    });
    runStatsRecordHit(combat, enemy, summon, hit(50, { died: true }));

    expect(flushed()).toMatchObject({
      damageTaken: 20,
      damageBlocked: 8,
      deaths: 1,
      damageDealt: 0,
    });
  });

  it('credits healing, and status ticks to the hero resolved when applied', () => {
    const { combat, hero, enemy } = setup();

    runStatsRecordHit(combat, hero, hero, hit(-15));
    runStatsRecordHit(combat, undefined, enemy, {
      ...hit(7, { died: true }),
      creditHeroId: heroId,
    });

    expect(flushed()).toMatchObject({ healing: 15, damageDealt: 7, kills: 1 });
  });
});

describe('the round counter', () => {
  it('drops anything counted before a round restarts, so a replayed round is not doubled', () => {
    const { combat, hero, enemy } = setup();

    runStatsRecordHit(combat, hero, enemy, hit(10));
    runStatsCombatBegin();

    expect(flushed()).toBeUndefined();
  });
});

describe('combatApplySkillToTarget', () => {
  it('counts only the HP a hit really took, so overkill is capped', () => {
    const { combat, hero, enemy } = setup();
    hero.totalStats = { ...defaultStats(), Health: 100, Strength: 500 };
    enemy.hp = 10;
    const skill = buildEquipmentSkill({ name: 'Smash', family: 'Smash' });
    const technique = ensureEquipmentSkillTechnique({
      attributes: ['DamagesTarget'],
      damageScaling: { ...defaultStats(), Strength: 1 },
      combatMessage: '',
    });

    combatApplySkillToTarget(combat, hero, enemy, skill, technique);

    expect(flushed()).toMatchObject({
      damageDealt: 10,
      kills: 1,
      biggestHit: { amount: 10, skillFamily: 'Smash' },
    });
  });
});

describe('damage over time', () => {
  it("credits a summon's burn to its owner even after the summon is gone", () => {
    const { combat, summon, enemy } = setup();
    summon.totalStats = { ...defaultStats(), Health: 100, Strength: 10 };
    enemy.hp = 5;
    const burn = ensureStatusEffect({
      id: 'burn' as StatusEffectId,
      name: 'Burn',
      effectType: 'Buff',
      trigger: 'TurnStart',
      onTick: [{ type: 'TakeDamage', combatMessage: '' }],
      statScaling: { ...defaultStats(), Strength: 1 },
    });
    seedContent([burn]);
    vi.mocked(rngSucceedsChance).mockReturnValue(true);
    const technique = ensureEquipmentSkillTechnique({
      attributes: [],
      combatMessage: '',
      statusEffects: [{ statusEffectId: burn.id, chance: 100, duration: 2 }],
    });

    combatApplySkillToTarget(
      combat,
      summon,
      enemy,
      buildEquipmentSkill({ name: 'Ignite', family: 'Ignite' }),
      technique,
    );
    combat.helpers = combat.helpers.filter((entry) => entry !== summon);
    combatTickCombatantStatusEffects(combat, enemy, 'TurnStart');

    expect(flushed()).toMatchObject({
      statusEffectsApplied: 1,
      damageDealt: 5,
      kills: 1,
    });
  });
});

describe('runStatsMergeHero', () => {
  it('adds counts, keeps the bigger hit and changes neither input', () => {
    const into = {
      ...defaultHeroRunStats(),
      kills: 2,
      skillUses: { Fire: 1 },
      biggestHit: { amount: 50, skillFamily: 'Fire' },
    };
    const from = {
      ...defaultHeroRunStats(),
      kills: 3,
      skillUses: { Fire: 2, Ice: 1 },
      biggestHit: { amount: 20, skillFamily: 'Ice' },
    };

    expect(runStatsMergeHero(into, from)).toMatchObject({
      kills: 5,
      skillUses: { Fire: 3, Ice: 1 },
      biggestHit: { amount: 50, skillFamily: 'Fire' },
    });
    expect(into.kills).toBe(2);
    expect(into.skillUses).toEqual({ Fire: 1 });
  });
});
