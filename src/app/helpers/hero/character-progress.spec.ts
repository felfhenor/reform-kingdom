import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { combatantDamageEvents } from '@helpers/combat/combat-damage-events';
import { combatLog } from '@helpers/combat/combat-log';
import {
  CHARACTER_MAX_LEVEL,
  HEALING_MINIMUM_SECONDS,
  HEALING_SECONDS_PER_LEVEL,
} from '@helpers/config';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkill } from '@helpers/content/ensure-skill';
import { defaultStats } from '@helpers/defaults';
import { heroLevelUpVfx$ } from '@helpers/engine/hero-level-up-vfx';
import {
  healingTicksForLevel,
  healPartyToFull,
  partyGainXp,
  partyXpGainAmount,
  retrofitPartyXp,
  syncPartyHpFromCombat,
} from '@helpers/hero/character-progress';
import { characterStats, characterXpForLevel } from '@helpers/hero/party';
import { worldPartyState } from '@helpers/state-game';
import { taskEventLevelReached } from '@helpers/task/task-events';
import type {
  Character,
  CharacterId,
  EquipmentSkillId,
  JobContent,
  JobId,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { buildCharacter, buildHeroCombatant } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const explorerId = 'job-explorer' as JobId;
const attackId = 'skill-attack' as EquipmentSkillId;

function seedJob(overrides: Partial<JobContent> = {}): void {
  seedContent([
    ensureJob({
      id: explorerId,
      name: 'Explorer',
      baseStats: { ...defaultStats(), Health: 100, Energy: 25 },
      statsPerLevel: { ...defaultStats(), Health: 10, Energy: 5 },
      ...overrides,
    }),
    ensureSkill({ id: attackId, name: 'Attack' }),
  ]);
}

function hero(name: string, overrides: Partial<Character> = {}): Character {
  return buildCharacter({
    id: name as CharacterId,
    name,
    jobId: explorerId,
    ...overrides,
  });
}

function maxed(name: string): Character {
  return hero(name, { level: CHARACTER_MAX_LEVEL });
}

function seedParty(...party: Character[]): void {
  seedGamestate((state) => (state.world.party = party));
}

function gainXp(xpAtLevel: (level: number) => number) {
  return inTick(() => partyGainXp(xpAtLevel));
}

function party(): Character[] {
  return worldPartyState();
}

function captureLevelUpVfx(): string[] {
  const ids: string[] = [];
  const subscription = heroLevelUpVfx$.subscribe((id) => ids.push(id));
  onTestFinished(() => subscription.unsubscribe());
  return ids;
}

function messages(): string[] {
  return combatLog().map((entry) => entry.message);
}

beforeEach(() => {
  vi.clearAllMocks();
  combatantDamageEvents.set([]);
  seedJob();
});

describe('healingTicksForLevel', () => {
  it('is the minimum plus a per-level amount for the highest member, at least level 1', () => {
    expect(healingTicksForLevel([{ level: 3 }, { level: 7 }])).toBe(
      HEALING_MINIMUM_SECONDS + 7 * HEALING_SECONDS_PER_LEVEL,
    );
    expect(healingTicksForLevel([])).toBe(
      HEALING_MINIMUM_SECONDS + HEALING_SECONDS_PER_LEVEL,
    );
  });
});

describe('retrofitPartyXp', () => {
  it('rescales active and held jobs to the current curve, clamping without leveling', () => {
    const jala = hero('Jala', {
      level: 2,
      xp: { current: 999999, maximum: 999999 },
      jobProgress: {
        ['job-warrior' as JobId]: {
          level: 5,
          xp: { current: 10, maximum: 7 },
        },
      },
    });

    const [retrofitted] = retrofitPartyXp([jala]);

    expect(retrofitted.level).toBe(2);
    expect(retrofitted.xp).toEqual({
      current: characterXpForLevel(2),
      maximum: characterXpForLevel(2),
    });
    expect(retrofitted.jobProgress['job-warrior' as JobId]?.xp).toEqual({
      current: 10,
      maximum: characterXpForLevel(5),
    });
  });
});

describe('partyXpGainAmount', () => {
  it('applies the xp gain bonus, rounded', () => {
    seedGamestate();
    expect(partyXpGainAmount(152)).toBe(152);

    seedGamestate((state) => {
      state.globalEffectSums.xpGainMultiplierBonus = 0.0921;
      state.globalEffectSums.stats.Strength = 5;
    });
    expect(partyXpGainAmount(152)).toBe(Math.round(152 * 1.0921));
  });
});

describe('partyGainXp', () => {
  const toLevel2 = () => characterXpForLevel(1);
  // Comfortably under the level-1 threshold even after a 50% bonus.
  const smallGain = () => Math.floor(characterXpForLevel(1) / 4);

  it('adds xp below the threshold without leveling, logging or announcing', () => {
    const jala = hero('Jala');
    seedParty(jala);

    const events = captureAnalyticsEvents();
    const vfx = captureLevelUpVfx();

    gainXp(smallGain);

    expect(party()[0]).toMatchObject({
      level: 1,
      xp: { current: smallGain(), maximum: characterXpForLevel(1) },
      stats: jala.stats,
    });
    expect(messages()).toEqual([]);
    expect(events).toEqual([]);
    expect(vfx).toEqual([]);
    expect(taskEventLevelReached).not.toHaveBeenCalled();
  });

  it('levels up, carrying remainder xp across several levels and recalculating stats', () => {
    seedParty(hero('Jala'));

    gainXp(() => characterXpForLevel(1) + characterXpForLevel(2) + 15);

    const [jala] = party();
    expect(jala).toMatchObject({
      level: 3,
      xp: { current: 15, maximum: characterXpForLevel(3) },
    });
    expect(jala.stats).toEqual(characterStats(jala));
    expect(jala.stats.Health).toBeGreaterThan(hero('Jala').stats.Health);
  });

  it('stops at the max level, clamping xp to the final threshold', () => {
    seedParty(maxed('Jala'));

    gainXp(() => 999999);

    expect(party()[0].level).toBe(CHARACTER_MAX_LEVEL);
    expect(party()[0].xp.current).toBe(party()[0].xp.maximum);
  });

  it('grants each hero the xp for their own level, leaving zero-xp heroes untouched', () => {
    const bo = hero('Bo', { level: 9 });
    seedParty(hero('Jala'), bo);

    gainXp((level) => (level > 5 ? 0 : smallGain()));

    expect(party()[0].xp.current).toBe(smallGain());
    expect(party()[1]).toEqual(bo);
  });

  it('scales the granted xp by the xp gain bonus', () => {
    seedGamestate((state) => {
      state.world.party = [hero('Jala')];
      state.globalEffectSums.xpGainMultiplierBonus = 0.5;
    });

    gainXp(smallGain);

    expect(party()[0].xp.current).toBe(Math.round(smallGain() * 1.5));
  });

  it('returns what each progressing hero gained, leaving out max-level and zero-xp heroes', () => {
    seedParty(hero('Jala'), hero('Bo', { level: 9 }), maxed('Max'));

    const gains = gainXp((level) => (level === 9 ? 0 : toLevel2()));

    expect(gains).toEqual([
      { characterId: 'Jala', xp: toLevel2(), leveledUp: true },
    ]);
  });

  it('emits an xp event for each hero that can still progress', () => {
    seedParty(hero('Jala'), maxed('Max'));

    gainXp(smallGain);

    expect(combatantDamageEvents()).toEqual([
      expect.objectContaining({
        combatantId: 'Jala',
        amount: smallGain(),
        variant: 'xp',
      }),
    ]);
  });

  it('announces a level-up with analytics, vfx, a log line and the task event', () => {
    seedParty(hero('Jala'));
    const events = captureAnalyticsEvents();
    const vfx = captureLevelUpVfx();

    gainXp(toLevel2);

    expect(events).toEqual(['Hero:LevelUp']);
    expect(vfx).toEqual(['Jala']);
    expect(messages()).toEqual(['**Jala** reached level 2!']);
    expect(taskEventLevelReached).toHaveBeenCalledWith(2);
  });

  it('still levels up and logs a hero whose job content no longer exists', () => {
    seedParty(hero('Jala', { jobId: 'gone' as JobId }));

    gainXp(toLevel2);

    expect(party()[0].level).toBe(2);
    expect(messages()).toEqual(['**Jala** reached level 2!']);
  });

  it('logs each skill newly unlocked by the level-up', () => {
    seedJob({
      skillPath: [
        { pathName: 'Attack', levels: [{ level: 2, skillId: attackId }] },
      ],
    });
    seedParty(hero('Jala'));

    gainXp(toLevel2);

    expect(messages()).toContain('**Jala** learned **Attack**!');
  });
});

describe('syncPartyHpFromCombat / healPartyToFull', () => {
  it("copies each hero's hp and ep back from combat, clamped to their maximums", () => {
    const jala = hero('Jala');
    const bo = hero('Bo', { hp: 7, ep: 3 });
    seedParty(jala, bo);

    inTick(() =>
      syncPartyHpFromCombat([
        buildHeroCombatant(jala, {
          hp: jala.stats.Health + 999,
          ep: jala.stats.Energy + 999,
        }),
      ]),
    );

    expect(party()[0]).toMatchObject({
      hp: jala.stats.Health,
      ep: jala.stats.Energy,
    });
    expect(party()[1]).toEqual(bo);
  });

  it("restores every hero's hp and ep to their maximums", () => {
    const jala = hero('Jala', { hp: 1, ep: 0 });
    seedParty(jala);

    inTick(healPartyToFull);

    expect(party()[0]).toMatchObject({
      hp: jala.stats.Health,
      ep: jala.stats.Energy,
    });
  });
});
