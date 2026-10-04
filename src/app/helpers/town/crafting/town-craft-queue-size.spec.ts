import { describe, expect, it } from 'vitest';

import { ensureTown } from '@helpers/content/ensure-town';
import { townCraftQueueSize } from '@helpers/town/crafting/town-craft-queue-size';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import type { TownId } from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const town = (maxQueueSize: { tier: number; value: number }[]) =>
  ensureTown({ id: townId, crafting: { maxQueueSize } });

const atTier = (tier: number) =>
  seedGamestate(
    (state) =>
      (state.world.towns[townId] = buildTownNodeState({
        reputation: TOWN_REPUTATION_THRESHOLDS[tier],
      })),
  );

describe('townCraftQueueSize', () => {
  it('uses the size of the reputation tier, or the nearest listed tier below it', () => {
    const sizes = town([
      { tier: 0, value: 10 },
      { tier: 3, value: 15 },
    ]);

    atTier(3);
    expect(townCraftQueueSize(sizes)).toBe(15);

    atTier(2);
    expect(townCraftQueueSize(sizes)).toBe(10);
  });

  it('is 0 with no size at or below the tier', () => {
    atTier(2);

    expect(townCraftQueueSize(town([]))).toBe(0);
  });
});
