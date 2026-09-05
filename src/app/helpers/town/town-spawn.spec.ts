import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSafeSegment: vi.fn((s) => s),
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/reputation/town-reputation', () => ({
  townReputationTier: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  worldNodeAtCurrentLocation: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  kingdomNodeGet: vi.fn(),
  worldNodeByName: vi.fn(),
  worldNodeTown: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import {
  canSetHomeNode,
  homeNodeGet,
  homeNodeSet,
  isPlayerAtHome,
  pruneInvalidHomeNode,
} from '@helpers/town/town-spawn';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import {
  kingdomNodeGet,
  worldNodeByName,
  worldNodeTown,
} from '@helpers/world-node/world-nodes';
import type {
  GameState,
  TownContent,
  TownId,
  WorldNodeEntry,
} from '@interfaces';

const townId = 'larsia' as TownId;

function buildNode(overrides: Partial<WorldNodeEntry> = {}): WorldNodeEntry {
  return {
    mapName: 'LarsianDesert',
    x: 5,
    y: 5,
    nodeName: 'Larsia',
    nodeData: {} as WorldNodeEntry['nodeData'],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('homeNodeGet', () => {
  it('falls back to the kingdom when no home node is set', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { homeNodeName: undefined },
    } as unknown as GameState);
    const kingdom = buildNode({ nodeName: 'Duchy' });
    vi.mocked(kingdomNodeGet).mockReturnValue(kingdom);

    expect(homeNodeGet()).toBe(kingdom);
  });

  it('resolves the designated home town when it still exists', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { homeNodeName: 'Larsia' },
    } as unknown as GameState);
    const townNode = buildNode();
    vi.mocked(worldNodeByName).mockReturnValue(townNode);
    vi.mocked(worldNodeTown).mockReturnValue({ id: townId } as TownContent);

    expect(homeNodeGet()).toBe(townNode);
  });

  it('falls back to the kingdom when the designated home node no longer resolves to a Town', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { homeNodeName: 'Larsia' },
    } as unknown as GameState);
    vi.mocked(worldNodeByName).mockReturnValue(undefined);
    const kingdom = buildNode({ nodeName: 'Duchy' });
    vi.mocked(kingdomNodeGet).mockReturnValue(kingdom);

    expect(homeNodeGet()).toBe(kingdom);
  });
});

describe('isPlayerAtHome', () => {
  it('is true when the current location matches the home node', () => {
    const node = buildNode();
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(node);
    vi.mocked(gamestate).mockReturnValue({
      world: { homeNodeName: 'Larsia' },
    } as unknown as GameState);
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(worldNodeTown).mockReturnValue({ id: townId } as TownContent);

    expect(isPlayerAtHome()).toBe(true);
  });

  it('is false when the current location differs from the home node', () => {
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(
      buildNode({ nodeName: 'SomewhereElse' }),
    );
    vi.mocked(gamestate).mockReturnValue({
      world: { homeNodeName: undefined },
    } as unknown as GameState);
    vi.mocked(kingdomNodeGet).mockReturnValue(buildNode({ nodeName: 'Duchy' }));

    expect(isPlayerAtHome()).toBe(false);
  });
});

describe('canSetHomeNode', () => {
  it('is false when the town has never been visited', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    expect(canSetHomeNode(townId)).toBe(false);
  });

  it('is false when reputation is below Honored', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { firstVisitedAtTick: 10 } } },
    } as unknown as GameState);
    vi.mocked(townReputationTier).mockReturnValue(1);

    expect(canSetHomeNode(townId)).toBe(false);
  });

  it('is true once visited and at Honored+ reputation', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { firstVisitedAtTick: 10 } } },
    } as unknown as GameState);
    vi.mocked(townReputationTier).mockReturnValue(2);

    expect(canSetHomeNode(townId)).toBe(true);
  });
});

describe('homeNodeSet', () => {
  it('does nothing when the town is not eligible', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    homeNodeSet(townId);

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
  });

  it('does nothing when the town content cannot be resolved', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { firstVisitedAtTick: 10 } } },
    } as unknown as GameState);
    vi.mocked(townReputationTier).mockReturnValue(2);
    vi.mocked(getEntry).mockReturnValue(undefined);

    homeNodeSet(townId);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('sets the home node and fires analytics once eligible', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { firstVisitedAtTick: 10 } } },
    } as unknown as GameState);
    vi.mocked(townReputationTier).mockReturnValue(3);
    vi.mocked(getEntry).mockReturnValue({
      id: townId,
      name: 'Larsia',
    } as TownContent);
    vi.mocked(updateGamestate).mockImplementation(async (fn) =>
      fn({ world: {} } as unknown as GameState),
    );

    homeNodeSet(townId);

    const state = { world: {} } as unknown as GameState;
    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    updateFn(state);

    expect(state.world.homeNodeName).toBe('Larsia');
    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Town:Home:Set:Larsia',
    );
  });
});

describe('pruneInvalidHomeNode', () => {
  it('passes through undefined', () => {
    expect(pruneInvalidHomeNode(undefined)).toBeUndefined();
  });

  it('keeps a home node that still resolves to a Town', () => {
    vi.mocked(worldNodeByName).mockReturnValue(buildNode());
    vi.mocked(worldNodeTown).mockReturnValue({ id: townId } as TownContent);

    expect(pruneInvalidHomeNode('Larsia')).toBe('Larsia');
  });

  it('drops a home node whose content no longer resolves', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(pruneInvalidHomeNode('Larsia')).toBeUndefined();
  });

  it('drops a home node whose node is no longer a Town', () => {
    vi.mocked(worldNodeByName).mockReturnValue(buildNode());
    vi.mocked(worldNodeTown).mockReturnValue(undefined);

    expect(pruneInvalidHomeNode('Larsia')).toBeUndefined();
  });
});
