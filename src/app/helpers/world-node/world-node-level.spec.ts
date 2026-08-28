import type * as AnalyticsHelper from '@helpers/engine/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/item/materials', () => ({
  hasGold: vi.fn(),
  spendGold: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

vi.mock('@helpers/world', () => ({
  worldNodeAtCurrentLocation: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeGathering: vi.fn(),
}));

import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { hasGold, spendGold } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import {
  gatherNodeLevelUp,
  isPartyAtGatherNode,
  pruneInvalidGatherNodeLevels,
  worldNodeIsMaxLevel,
  worldNodeLevel,
  worldNodeLevelUpCost,
  worldNodeMaxAchievableLevel,
} from '@helpers/world-node/world-node-level';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type { GameState, GatheringContent, WorldNodeEntry } from '@interfaces';

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

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

describe('gatherNodeLevelUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: {},
    } as unknown as GameState);
  });

  it('fails when there is no matching node', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(gatherNodeLevelUp('Nowhere')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the node is not a gather node', () => {
    vi.mocked(worldNodeByName).mockReturnValue({} as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(undefined);

    expect(gatherNodeLevelUp('Field Ruins')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the node is already at its max achievable level (maxLevel - 1)', () => {
    vi.mocked(worldNodeByName).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(
      buildGathering({ maxLevel: 2 }),
    );
    vi.mocked(gamestate).mockReturnValue({
      gatherNodeLevels: { 'Carrina Copper Mines': { level: 1 } },
    } as unknown as GameState);

    expect(gatherNodeLevelUp('Carrina Copper Mines')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the party is not at the node', () => {
    vi.mocked(worldNodeByName).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(buildGathering());
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(undefined);

    expect(gatherNodeLevelUp('Carrina Copper Mines')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when gold is insufficient', () => {
    vi.mocked(worldNodeByName).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(
      buildGathering({ levelCostScalar: 10000 }),
    );
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);
    vi.mocked(hasGold).mockReturnValue(false);

    expect(gatherNodeLevelUp('Carrina Copper Mines')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('spends gold and increments the level on success', () => {
    vi.mocked(worldNodeByName).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(
      buildGathering({ levelCostScalar: 10000, maxLevel: 5 }),
    );
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);
    vi.mocked(hasGold).mockReturnValue(true);

    expect(gatherNodeLevelUp('Carrina Copper Mines')).toBe(true);

    const result = applyLastUpdate({
      gatherNodeLevels: {},
    } as unknown as GameState);
    expect(spendGold).toHaveBeenCalledWith(result, 10000);
    expect(result.gatherNodeLevels['Carrina Copper Mines']).toEqual({
      level: 1,
    });
    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'World:GatherNode:LevelUp:Carrina Copper Mines',
    );
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
