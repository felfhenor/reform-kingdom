import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    gatherNodeLevelsState: () => gamestate().gatherNodeLevels,
  };
});

import { gamestate } from '@helpers/state-game';
import {
  pruneInvalidGatherNodeLevels,
  worldNodeIsMaxLevel,
  worldNodeLevel,
  worldNodeLevelUpCost,
  worldNodeMaxAchievableLevel,
} from '@helpers/world-node/world-node-level';
import type {
  GameState,
  GatheringContent,
  GatherLevelCost,
  ItemId,
} from '@interfaces';

function buildGathering(
  overrides: Partial<GatheringContent> = {},
): GatheringContent {
  return {
    levelCost: [
      { costs: [{ itemId: 'Gold Coin' as ItemId, required: 10000 }] },
      { costs: [{ itemId: 'Gold Coin' as ItemId, required: 20000 }] },
      { costs: [{ itemId: 'Gold Coin' as ItemId, required: 30000 }] },
      { costs: [{ itemId: 'Gold Coin' as ItemId, required: 40000 }] },
      { costs: [{ itemId: 'Gold Coin' as ItemId, required: 50000 }] },
    ] as GatherLevelCost[],
    ...overrides,
  } as GatheringContent;
}

describe('worldNodeLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to 0 when the node has no stored level', () => {
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: {},
    } as unknown as GameState);

    expect(worldNodeLevel('Carrina Copper Mines')).toBe(0);
  });

  it('returns the stored level', () => {
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { 'Carrina Copper Mines': { level: 3 } },
    } as unknown as GameState);

    expect(worldNodeLevel('Carrina Copper Mines')).toBe(3);
  });

  it('defaults to 0 when gatherNodeLevels itself is missing (mid-migration, pre-old-save)', () => {
    vi.mocked(gamestate).mockReturnValue({} as unknown as GameState);

    expect(worldNodeLevel('Carrina Copper Mines')).toBe(0);
  });
});

describe('worldNodeMaxAchievableLevel', () => {
  it('is levelCost.length - 1, since gatherResults are authored 0..length-1', () => {
    expect(
      worldNodeMaxAchievableLevel(
        buildGathering({
          levelCost: [
            { costs: [] },
            { costs: [] },
            { costs: [] },
          ] as GatherLevelCost[],
        }),
      ),
    ).toBe(2);
  });
});

describe('worldNodeIsMaxLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false below the max achievable level (levelCost.length - 1)', () => {
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { Node: { level: 3 } },
    } as unknown as GameState);

    expect(worldNodeIsMaxLevel(buildGathering(), 'Node')).toBe(false);
  });

  it('is true at or above the max achievable level (levelCost.length - 1)', () => {
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { Node: { level: 4 } },
    } as unknown as GameState);

    expect(worldNodeIsMaxLevel(buildGathering(), 'Node')).toBe(true);
  });
});

describe('worldNodeLevelUpCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the costs authored at the current level tier', () => {
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { Node: { level: 0 } },
    } as unknown as GameState);
    expect(worldNodeLevelUpCost(buildGathering(), 'Node')).toEqual([
      { itemId: 'Gold Coin', required: 10000 },
    ]);

    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { Node: { level: 1 } },
    } as unknown as GameState);
    expect(worldNodeLevelUpCost(buildGathering(), 'Node')).toEqual([
      { itemId: 'Gold Coin', required: 20000 },
    ]);
  });

  it('returns an empty array once past the last authored tier', () => {
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { Node: { level: 99 } },
    } as unknown as GameState);

    expect(worldNodeLevelUpCost(buildGathering(), 'Node')).toEqual([]);
  });
});

describe('pruneInvalidGatherNodeLevels', () => {
  it('drops entries whose node no longer resolves to gathering content', () => {
    const result = pruneInvalidGatherNodeLevels(
      { 'Carrina Copper Mines': { level: 2 }, Removed: { level: 1 } },
      (nodeName) =>
        nodeName === 'Carrina Copper Mines' ? buildGathering() : undefined,
    );

    expect(result).toEqual({ 'Carrina Copper Mines': { level: 2 } });
  });

  it('clamps a stored level down to the current authored max achievable level (levelCost.length - 1)', () => {
    const result = pruneInvalidGatherNodeLevels(
      { 'Carrina Copper Mines': { level: 5 } },
      () =>
        buildGathering({
          levelCost: [{ costs: [] }, { costs: [] }] as GatherLevelCost[],
        }),
    );

    expect(result).toEqual({ 'Carrina Copper Mines': { level: 1 } });
  });
});
