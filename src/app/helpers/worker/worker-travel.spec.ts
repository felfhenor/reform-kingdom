import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/pathfinding/pathfinding', () => ({
  travelPathFrom: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  kingdomNodeGet: vi.fn(),
  worldNodeByName: vi.fn(),
  worldNodeGathering: vi.fn(),
}));

import { travelPathFrom } from '@helpers/pathfinding/pathfinding';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  workerBeginReturnTrip,
  workersTravelingTokens,
} from '@helpers/worker/worker-travel';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type { GameState, ItemId, WorkerId, WorldNodeEntry } from '@interfaces';

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

describe('workersTravelingTokens', () => {
  // Single read: `workersTravelingTokens` is a `computed()`, so a second call in this file
  // would replay this mock's cached result rather than re-invoking the mocked `gamestate()`.
  it('returns only TravelingTo/TravelingBack workers, mapped to their token fields', () => {
    const travelingToId = 'weaver-nell' as WorkerId;
    const travelingBackId = 'miner-joric' as WorkerId;
    const atDuchyId = 'idle-alma' as WorkerId;
    const gatheringId = 'gatherer-finn' as WorkerId;

    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [travelingToId]: {
          level: 1,
          xp: { current: 0, maximum: 10 },
          location: { mapName: 'Carrina', x: 0, y: 0 },
          status: {
            kind: 'TravelingTo',
            nodeName: 'Wergen Woods',
            itemId: 'copper-ore',
            path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
            ticksIntoStep: 2,
          },
          assignment: null,
        },
        [travelingBackId]: {
          level: 1,
          xp: { current: 0, maximum: 10 },
          location: { mapName: 'Carrina', x: 3, y: 3 },
          status: {
            kind: 'TravelingBack',
            path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 3 }],
            ticksIntoStep: 1,
            carriedItemId: 'copper-ore',
            carriedQuantity: 5,
          },
          assignment: null,
        },
        [atDuchyId]: {
          level: 1,
          xp: { current: 0, maximum: 10 },
          location: { mapName: 'Carrina', x: 0, y: 0 },
          status: { kind: 'AtDuchy' },
          assignment: null,
        },
        [gatheringId]: {
          level: 1,
          xp: { current: 0, maximum: 10 },
          location: { mapName: 'Wergen Woods', x: 5, y: 5 },
          status: {
            kind: 'Gathering',
            nodeName: 'Wergen Woods',
            itemId: 'copper-ore',
            itemsGathered: 2,
            ticksIntoGather: 3,
          },
          assignment: null,
        },
      },
    } as unknown as GameState);

    const tokens = workersTravelingTokens();

    expect(tokens).toEqual([
      {
        workerId: travelingToId,
        mapName: 'Carrina',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 2,
      },
      {
        workerId: travelingBackId,
        mapName: 'Carrina',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 3 }],
        ticksIntoStep: 1,
      },
    ]);
  });
});

describe('workerBeginReturnTrip', () => {
  const WORKER_ID = 'weaver-nell' as WorkerId;
  const COPPER_ID = 'copper-ore' as ItemId;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [WORKER_ID]: {
          location: { mapName: 'Carrina', x: 3, y: 3 },
        },
      },
    } as unknown as GameState);
    vi.mocked(kingdomNodeGet).mockReturnValue({
      nodeName: 'The Duchy',
    } as WorldNodeEntry);
  });

  it('returns true and starts the traveling-back status when a path home resolves', () => {
    const path = [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 3 }];
    vi.mocked(travelPathFrom).mockReturnValue(path as never);

    const result = workerBeginReturnTrip(WORKER_ID, COPPER_ID, 4);

    expect(result).toBe(true);
    const state = applyLastUpdate({
      workers: { [WORKER_ID]: {} },
    } as unknown as GameState);
    expect(state.workers[WORKER_ID].status).toMatchObject({
      kind: 'TravelingBack',
      path,
      carriedItemId: COPPER_ID,
      carriedQuantity: 4,
    });
  });

  it('returns false and parks AtDuchy when no path home resolves', () => {
    vi.mocked(travelPathFrom).mockReturnValue(undefined);

    const result = workerBeginReturnTrip(WORKER_ID, COPPER_ID, 4);

    expect(result).toBe(false);
    const state = applyLastUpdate({
      workers: { [WORKER_ID]: {} },
    } as unknown as GameState);
    expect(state.workers[WORKER_ID].status).toEqual({ kind: 'AtDuchy' });
  });
});
