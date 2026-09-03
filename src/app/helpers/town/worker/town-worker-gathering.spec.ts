import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-progression', () => ({
  townWorkerStatsForLevel: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-travel', () => ({
  townWorkerAssignmentIsValid: vi.fn(() => true),
  townWorkerBeginReturnTrip: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-gathering', () => ({
  gatheringResultsAtLevel: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-level', () => ({
  worldNodeLevel: vi.fn(() => 1),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeGathering: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  townWorkerGatherRate,
  townWorkerGatheringProcessTick,
} from '@helpers/town/worker/town-worker-gathering';
import { townWorkerStatsForLevel } from '@helpers/town/worker/town-worker-progression';
import {
  townWorkerAssignmentIsValid,
  townWorkerBeginReturnTrip,
} from '@helpers/town/worker/town-worker-travel';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  GameState,
  GatheringContent,
  ItemId,
  TownContent,
  TownId,
  WorkerContent,
  WorkerId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const workerId = 'darwin' as WorkerId;
const oreId = 'copper-ore' as ItemId;

function buildTown(gatherRateMultiplier = 1): TownContent {
  return {
    id: townId,
    gathering: { gatherRateMultiplier },
  } as unknown as TownContent;
}

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(true);
});

describe('townWorkerGatherRate', () => {
  it("scales the base rate by the town's gatherRateMultiplier", () => {
    vi.mocked(townWorkerStatsForLevel).mockReturnValue({
      capacity: 5,
      gatherSpeed: 2,
      stamina: 20,
    });
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 10, items: [{ itemId: oreId, quantity: 1 }] },
    ] as never);

    const rate = townWorkerGatherRate(
      {} as WorkerContent,
      1,
      {} as GatheringContent,
      oreId,
      1,
      3,
    );

    expect(rate).toBe(6);
  });

  it('returns 0 when the node does not gather the item', () => {
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 10, items: [{ itemId: 'iron-ore' as ItemId, quantity: 1 }] },
    ] as never);

    expect(
      townWorkerGatherRate(
        {} as WorkerContent,
        1,
        {} as GatheringContent,
        oreId,
        1,
        1,
      ),
    ).toBe(0);
  });
});

describe('townWorkerGatheringProcessTick', () => {
  function mockGatheringState(itemsGathered: number, ticksIntoGather: number) {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                level: 1,
                status: {
                  kind: 'Gathering',
                  nodeName: 'Wergen Woods',
                  itemId: oreId,
                  itemsGathered,
                  ticksIntoGather,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);
  }

  beforeEach(() => {
    vi.mocked(getEntry).mockReturnValue({} as WorkerContent);
    vi.mocked(worldNodeByName).mockReturnValue({} as never);
    vi.mocked(worldNodeGathering).mockReturnValue({
      gatherTime: 5,
    } as GatheringContent);
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 10, items: [{ itemId: oreId, quantity: 1 }] },
    ] as never);
    vi.mocked(townWorkerStatsForLevel).mockReturnValue({
      capacity: 2,
      gatherSpeed: 1,
      stamina: 20,
    });
  });

  it('abandons the gather when the assignment is no longer valid', () => {
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(false);
    mockGatheringState(0, 0);

    townWorkerGatheringProcessTick(buildTown(), workerId);

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                status: { kind: 'Gathering' },
                assignment: { nodeName: 'x', itemId: oreId },
              },
            },
          },
        },
      },
    } as unknown as GameState);
    expect(state.world.towns[townId].workers[workerId].status).toEqual({
      kind: 'AtTown',
    });
    expect(state.world.towns[townId].workers[workerId].assignment).toBe(null);
  });

  it('increments ticksIntoGather when a unit is not yet complete', () => {
    mockGatheringState(0, 0);

    townWorkerGatheringProcessTick(buildTown(), workerId);

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                status: {
                  kind: 'Gathering',
                  itemsGathered: 0,
                  ticksIntoGather: 0,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);
    expect(
      state.world.towns[townId].workers[workerId].status.ticksIntoGather,
    ).toBe(1);
  });

  it('completes a unit and starts the return trip once at capacity', () => {
    // gatherTime 5 / rate 1 = 5 ticks per unit; capacity 2.
    mockGatheringState(1, 4);

    townWorkerGatheringProcessTick(buildTown(), workerId);

    expect(townWorkerBeginReturnTrip).toHaveBeenCalledWith(
      townId,
      expect.anything(),
      workerId,
      oreId,
      2,
    );
  });

  it('completes a unit and stays Gathering when under capacity', () => {
    mockGatheringState(0, 4);

    townWorkerGatheringProcessTick(buildTown(), workerId);

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                status: {
                  kind: 'Gathering',
                  itemsGathered: 0,
                  ticksIntoGather: 4,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);
    expect(state.world.towns[townId].workers[workerId].status).toMatchObject({
      kind: 'Gathering',
      itemsGathered: 1,
      ticksIntoGather: 0,
    });
    expect(townWorkerBeginReturnTrip).not.toHaveBeenCalled();
  });
});
