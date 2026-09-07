import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  worldNodeAtCurrentLocation: vi.fn(),
}));

import { gamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import {
  isPartyAtGatherNode,
  pruneInvalidGatherNodeLevels,
  worldNodeIsMaxLevel,
  worldNodeLevel,
  worldNodeLevelUpCost,
  worldNodeMaxAchievableLevel,
} from '@helpers/world-node/world-node-level';
import type { GameState, GatheringContent, WorldNodeEntry } from '@interfaces';

function buildGathering(
  overrides: Partial<GatheringContent> = {},
): GatheringContent {
  return {
    maxLevel: 5,
    levelCostScalar: 10000,
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
  it('is maxLevel - 1, since gatherResults are authored 0..maxLevel-1', () => {
    expect(worldNodeMaxAchievableLevel(buildGathering({ maxLevel: 5 }))).toBe(
      4,
    );
  });
});

describe('worldNodeIsMaxLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false below the max achievable level (maxLevel - 1)', () => {
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { Node: { level: 3 } },
    } as unknown as GameState);

    expect(worldNodeIsMaxLevel(buildGathering({ maxLevel: 5 }), 'Node')).toBe(
      false,
    );
  });

  it('is true at or above the max achievable level (maxLevel - 1)', () => {
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { Node: { level: 4 } },
    } as unknown as GameState);

    expect(worldNodeIsMaxLevel(buildGathering({ maxLevel: 5 }), 'Node')).toBe(
      true,
    );
  });
});

describe('worldNodeLevelUpCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('costs levelCostScalar * (currentLevel + 1)', () => {
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { Node: { level: 0 } },
    } as unknown as GameState);
    expect(
      worldNodeLevelUpCost(buildGathering({ levelCostScalar: 10000 }), 'Node'),
    ).toBe(10000);

    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { Node: { level: 1 } },
    } as unknown as GameState);
    expect(
      worldNodeLevelUpCost(buildGathering({ levelCostScalar: 10000 }), 'Node'),
    ).toBe(20000);
  });
});

describe('isPartyAtGatherNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true when the party is standing on that node', () => {
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);

    expect(isPartyAtGatherNode('Carrina Copper Mines')).toBe(true);
  });

  it('is false when the party is elsewhere', () => {
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: 'Wergen Woods',
    } as WorldNodeEntry);

    expect(isPartyAtGatherNode('Carrina Copper Mines')).toBe(false);
  });

  it('is false when the party is not standing on any node', () => {
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(undefined);

    expect(isPartyAtGatherNode('Carrina Copper Mines')).toBe(false);
  });
});

describe('pruneInvalidGatherNodeLevels', () => {
  it('drops entries whose node no longer resolves to gathering content', () => {
    const result = pruneInvalidGatherNodeLevels(
      { 'Carrina Copper Mines': { level: 2 }, Removed: { level: 1 } },
      (nodeName) =>
        nodeName === 'Carrina Copper Mines'
          ? buildGathering({ maxLevel: 5 })
          : undefined,
    );

    expect(result).toEqual({ 'Carrina Copper Mines': { level: 2 } });
  });

  it('clamps a stored level down to the current authored max achievable level (maxLevel - 1)', () => {
    const result = pruneInvalidGatherNodeLevels(
      { 'Carrina Copper Mines': { level: 5 } },
      () => buildGathering({ maxLevel: 2 }),
    );

    expect(result).toEqual({ 'Carrina Copper Mines': { level: 1 } });
  });
});
