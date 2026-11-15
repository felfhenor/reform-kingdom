import { describe, expect, it } from 'vitest';

import {
  achievementProgress,
  achievementProgressIsMet,
} from '@helpers/achievement/achievement';
import { ensureJob } from '@helpers/content/ensure-job';
import type { CollectibleId, JobId, MonsterId } from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

describe('achievementProgress', () => {
  it('caps a counter at its target', () => {
    seedGamestate((state) => {
      state.world.party = [buildCharacter({ level: 40 })];
    });

    expect(
      achievementProgress({ type: 'Reach', counter: 'PartyLevel', target: 10 }),
    ).toEqual({ current: 10, max: 10 });
  });

  it("counts one hero's jobs at level 50, current job included", () => {
    seedContent([
      ensureJob({ id: 'a' as JobId, name: 'A' }),
      ensureJob({ id: 'b' as JobId, name: 'B' }),
      ensureJob({ id: 'c' as JobId, name: 'C' }),
    ]);
    const progress = (level: number) => ({
      level,
      xp: { current: 0, maximum: 1 },
    });
    seedGamestate((state) => {
      state.world.party = [
        buildCharacter({
          jobId: 'a' as JobId,
          level: 50,
          jobProgress: {
            ['b' as JobId]: progress(50),
            ['c' as JobId]: progress(49),
          },
        }),
        buildCharacter({ jobId: 'c' as JobId, level: 50 }),
      ];
    });

    expect(
      achievementProgress({ type: 'Reach', counter: 'JobsMastered' }),
    ).toEqual({ current: 2, max: 3 });
  });

  it('counts each listed monster once it has been killed', () => {
    seedGamestate((state) => {
      state.bestiary['a' as MonsterId] = {
        foundAt: 0,
        kills: 2,
        minLevelFound: 1,
        maxLevelFound: 1,
        foundAtNodes: [],
        analyzed: false,
      };
    });

    expect(
      achievementProgress({
        type: 'Defeat',
        monsterIds: ['a' as MonsterId, 'b' as MonsterId],
      }),
    ).toEqual({ current: 1, max: 2 });
  });

  it('counts each listed collectible once it has been found', () => {
    seedGamestate((state) => {
      state.collectibles['a' as CollectibleId] = { quantity: 1, foundAt: 1 };
    });

    expect(
      achievementProgress({
        type: 'Collect',
        collectibleIds: ['a' as CollectibleId, 'b' as CollectibleId],
      }),
    ).toEqual({ current: 1, max: 2 });
  });

  it('never treats an empty counter as met', () => {
    expect(achievementProgressIsMet({ current: 0, max: 0 })).toBe(false);
    expect(
      achievementProgress({ type: 'Reach', counter: 'OutpostsBuilt' }),
    ).toEqual({ current: 0, max: 0 });
  });
});
