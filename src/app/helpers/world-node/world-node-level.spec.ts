import { describe, expect, it } from 'vitest';

import { ensureGathering } from '@helpers/content/ensure-gathernode';
import {
  pruneInvalidGatherNodeLevels,
  worldNodeIsMaxLevel,
  worldNodeLevel,
  worldNodeLevelUpCost,
  worldNodeMaxAchievableLevel,
} from '@helpers/world-node/world-node-level';
import type { GameState, GatheringContent, ItemId } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';

const mines = 'Carrina Copper Mines';
const goldCost = (required: number) => ({
  costs: [{ itemId: 'gold' as ItemId, required }],
});

function gathering(tiers: number): GatheringContent {
  return ensureGathering({
    name: mines,
    levelCost: Array.from({ length: tiers }, (_, i) => goldCost((i + 1) * 100)),
  });
}

function atLevel(level?: number): void {
  seedGamestate((state) => {
    if (level !== undefined) state.gatherNodeLevels[mines] = { level };
  });
}

describe('worldNodeLevel', () => {
  it('reads the stored level, defaulting to 0 even before the levels slice exists', () => {
    atLevel(3);
    expect(worldNodeLevel(mines)).toBe(3);

    atLevel();
    expect(worldNodeLevel(mines)).toBe(0);

    seedGamestate((state) => {
      delete (state as Partial<GameState>).gatherNodeLevels;
    });
    expect(worldNodeLevel(mines)).toBe(0);
  });
});

describe('leveling up a node', () => {
  const fiveTiers = gathering(5);

  it('tops out one below the number of authored cost tiers', () => {
    expect(worldNodeMaxAchievableLevel(fiveTiers)).toBe(4);

    atLevel(3);
    expect(worldNodeIsMaxLevel(fiveTiers, mines)).toBe(false);
    atLevel(4);
    expect(worldNodeIsMaxLevel(fiveTiers, mines)).toBe(true);
    atLevel(5);
    expect(worldNodeIsMaxLevel(fiveTiers, mines)).toBe(true);
  });

  it('costs whatever is authored at the current level, nothing past the last tier', () => {
    atLevel();
    expect(worldNodeLevelUpCost(fiveTiers, mines)).toEqual(goldCost(100).costs);

    atLevel(1);
    expect(worldNodeLevelUpCost(fiveTiers, mines)).toEqual(goldCost(200).costs);

    atLevel(99);
    expect(worldNodeLevelUpCost(fiveTiers, mines)).toEqual([]);
  });
});

describe('pruneInvalidGatherNodeLevels', () => {
  it('drops nodes no longer in content and clamps levels to the authored max', () => {
    expect(
      pruneInvalidGatherNodeLevels(
        { [mines]: { level: 5 }, Removed: { level: 1 } },
        (nodeName) => (nodeName === mines ? gathering(2) : undefined),
      ),
    ).toEqual({ [mines]: { level: 1 } });
  });
});
