import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/hero/travel', () => ({
  travelPathTotalTicks: vi.fn(),
}));

vi.mock('@helpers/item/gather-node-discovery', () => ({
  isGatherNodeDiscovered: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/pathfinding/pathfinding-travel', () => ({
  travelPathFrom: vi.fn(),
}));

vi.mock('@helpers/worker/worker-progression', () => ({
  workerStatsForLevel: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-gathering', () => ({
  gatheringResultsAtLevel: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-level', () => ({
  worldNodeLevel: vi.fn(() => 1),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  kingdomNodeGet: vi.fn(),
  worldNodeByName: vi.fn(),
  worldNodeGathering: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { travelPathTotalTicks } from '@helpers/hero/travel';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import {
  workerAssignmentIsValid,
  workerBeginOutboundTrip,
  workerBeginReturnTrip,
} from '@helpers/worker/worker-travel';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import {
  kingdomNodeGet,
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type { GameState, ItemId, WorkerId, WorldNodeEntry } from '@interfaces';

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

describe('workerAssignmentIsValid', () => {
  const WORKER_ID = 'weaver-nell' as WorkerId;
  const COPPER_ID = 'copper-ore' as ItemId;
  const assignment = { nodeName: 'Wergen Woods', itemId: COPPER_ID };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntry).mockReturnValue({ canUseTeleports: true } as never);
    vi.mocked(workerStatsForLevel).mockReturnValue({
      capacity: 5,
      gatherSpeed: 1,
      stamina: 20,
    });
    vi.mocked(isGatherNodeDiscovered).mockReturnValue(true);
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 5,
      y: 5,
    } as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue({} as never);
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 10, items: [{ itemId: COPPER_ID, quantity: 1 }] },
    ] as never);
    vi.mocked(kingdomNodeGet).mockReturnValue({
      nodeName: 'The Duchy',
    } as WorldNodeEntry);
    vi.mocked(travelPathFrom).mockReturnValue([
      { kind: 'Move', mapName: 'Carrina', x: 6, y: 5 },
    ] as never);
    vi.mocked(travelPathTotalTicks).mockReturnValue(10);
  });

  it('is valid when the worker can use teleports and stamina covers the trip', () => {
    expect(workerAssignmentIsValid(WORKER_ID, 1, assignment)).toBe(true);
  });

  it("routes with the worker content's canUseTeleports flag", () => {
    vi.mocked(getEntry).mockReturnValue({ canUseTeleports: false } as never);

    workerAssignmentIsValid(WORKER_ID, 1, assignment);

    expect(travelPathFrom).toHaveBeenCalledWith(
      expect.anything(),
      assignment.nodeName,
      false,
    );
  });
});

describe('workerBeginOutboundTrip', () => {
  const WORKER_ID = 'weaver-nell' as WorkerId;
  const COPPER_ID = 'copper-ore' as ItemId;
  const assignment = { nodeName: 'Wergen Woods', itemId: COPPER_ID };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(kingdomNodeGet).mockReturnValue({
      nodeName: 'The Duchy',
    } as WorldNodeEntry);
  });

  it('blocks the trip from crossing a teleport when the worker cannot use them', () => {
    vi.mocked(getEntry).mockReturnValue({ canUseTeleports: false } as never);

    workerBeginOutboundTrip(WORKER_ID, assignment);

    expect(travelPathFrom).toHaveBeenCalledWith(
      expect.anything(),
      assignment.nodeName,
      false,
    );
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

  it("routes with the worker content's canUseTeleports flag", () => {
    vi.mocked(getEntry).mockReturnValue({ canUseTeleports: false } as never);
    vi.mocked(travelPathFrom).mockReturnValue(undefined);

    workerBeginReturnTrip(WORKER_ID, COPPER_ID, 4);

    expect(travelPathFrom).toHaveBeenCalledWith(
      expect.anything(),
      'The Duchy',
      false,
    );
  });
});
