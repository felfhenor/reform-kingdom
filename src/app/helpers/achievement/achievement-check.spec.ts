import { describe, expect, it, onTestFinished } from 'vitest';

import {
  achievementsCheckLive,
  achievementsCheckRun,
} from '@helpers/achievement/achievement-check';
import { achievementsAnnounced$ } from '@helpers/achievement/achievement-unlock';
import { ensureAchievement } from '@helpers/content/ensure-achievement';
import { ensureCollectible } from '@helpers/content/ensure-item';
import { legacy } from '@helpers/legacy/legacy';
import { updateGamestate } from '@helpers/state-game';
import type {
  AchievementAnnouncement,
  AchievementId,
  CollectibleId,
  GameId,
  MonsterId,
} from '@interfaces';
import { buildCharacter, buildRunRecord } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { useLegacyStorage } from '@/testing/legacy';

useLegacyStorage();

const twoRuns = ensureAchievement({
  id: 'two-runs' as AchievementId,
  name: 'Two Runs',
  condition: { type: 'CompleteRun', count: 2 },
});
const level10 = ensureAchievement({
  id: 'level-10' as AchievementId,
  name: 'Level 10',
  condition: { type: 'Reach', counter: 'PartyLevel', target: 10 },
});
const queen = ensureAchievement({
  id: 'queen' as AchievementId,
  name: 'Queen',
  condition: { type: 'Defeat', monsterIds: ['queen' as MonsterId] },
});

function announcements(): AchievementAnnouncement[] {
  const seen: AchievementAnnouncement[] = [];
  const subscription = achievementsAnnounced$.subscribe((announcement) =>
    seen.push(announcement),
  );
  onTestFinished(() => subscription.unsubscribe());
  return seen;
}

describe('achievementsCheckRun', () => {
  it('counts the run with the recorded ones, dated to the run that reached the count', () => {
    seedContent([twoRuns]);
    legacy.set({
      ...legacy(),
      runs: [buildRunRecord({ id: 'a' as GameId, endedAt: 10 })],
    });

    achievementsCheckRun(buildRunRecord({ id: 'b' as GameId, endedAt: 20 }));

    expect(legacy().achievements?.[twoRuns.id]).toEqual({
      unlockedAt: 20,
      runId: 'b',
    });
  });
});

describe('modded runs', () => {
  const MOD = { id: 'm', name: 'M', version: '1', kind: 'content' as const };

  it('never count toward run achievements, even when recorded', () => {
    seedContent([twoRuns]);
    legacy.set({
      ...legacy(),
      runs: [buildRunRecord({ id: 'a' as GameId, endedAt: 10, mods: [MOD] })],
    });

    achievementsCheckRun(buildRunRecord({ id: 'b' as GameId, endedAt: 20 }));
    achievementsCheckRun(
      buildRunRecord({ id: 'c' as GameId, endedAt: 30, mods: [MOD] }),
    );

    expect(legacy().achievements?.[twoRuns.id]).toBeUndefined();
  });

  it('skip live checks, but i18n mods do not', () => {
    seedContent([level10]);
    seedGamestate((state) => {
      state.world.party = [buildCharacter({ level: 10 })];
      state.meta.mods = [MOD];
    });
    achievementsCheckLive();
    expect(legacy().achievements?.[level10.id]).toBeUndefined();

    seedGamestate((state) => {
      state.world.party = [buildCharacter({ level: 10 })];
      state.meta.mods = [{ ...MOD, kind: 'i18n' }];
    });
    achievementsCheckLive();
    expect(legacy().achievements?.[level10.id]).toBeDefined();
  });
});

describe('achievementsCheckLive', () => {
  it('unlocks what the current save has reached, and nothing else', () => {
    seedContent([level10, queen, twoRuns]);
    const { gameId } = seedGamestate((state) => {
      state.world.party = [
        buildCharacter({ level: 12 }),
        buildCharacter({ level: 10 }),
      ];
    });

    achievementsCheckLive();

    expect(legacy().achievements?.[level10.id]?.runId).toBe(gameId);
    expect(legacy().achievements?.[queen.id]).toBeUndefined();
    expect(legacy().achievements?.[twoRuns.id]).toBeUndefined();
  });

  it('re-checks once the slice it reads changes', () => {
    seedContent([level10]);
    seedGamestate((state) => {
      state.world.party = [buildCharacter({ level: 9 })];
    });
    achievementsCheckLive();
    expect(legacy().achievements?.[level10.id]).toBeUndefined();

    inTick(() =>
      updateGamestate((state) => {
        state.world.party[0].level = 10;
        return state;
      }),
    );
    achievementsCheckLive();

    expect(legacy().achievements?.[level10.id]).toBeDefined();
  });

  it('skips achievements whose slices have not changed', () => {
    seedContent([level10]);
    seedGamestate((state) => {
      state.world.party = [buildCharacter({ level: 10 })];
    });
    achievementsCheckLive();
    legacy.set({ ...legacy(), achievements: {} });

    achievementsCheckLive();

    expect(legacy().achievements?.[level10.id]).toBeUndefined();
  });

  it("announces a save's first check as a catch-up", () => {
    seedContent([level10]);
    seedGamestate((state) => {
      state.world.party = [buildCharacter({ level: 10 })];
    });
    const seen = announcements();

    achievementsCheckLive();

    expect(seen[0]?.isCatchUp).toBe(true);
  });

  it('judges run achievements against the run as it stood when Fel fell', () => {
    const memory = ensureCollectible({
      id: 'memory' as CollectibleId,
      name: 'Memory of the Forgetter',
    });
    const anyRun = ensureAchievement({
      id: 'any-run' as AchievementId,
      name: 'Any Run',
      condition: { type: 'CompleteRun' },
    });
    seedContent([memory, anyRun]);
    const { gameId } = seedGamestate((state) => {
      state.collectibles[memory.id] = { quantity: 1, foundAt: 1 };
    });
    const seen = announcements();

    achievementsCheckLive();

    expect(legacy().achievements?.[anyRun.id]?.runId).toBe(gameId);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.isCatchUp).toBe(true);
  });

  it('waits for every hero to reach the level', () => {
    seedContent([level10]);
    seedGamestate((state) => {
      state.world.party = [
        buildCharacter({ level: 12 }),
        buildCharacter({ level: 9 }),
      ];
    });

    achievementsCheckLive();

    expect(legacy().achievements?.[level10.id]).toBeUndefined();
  });
});
