import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/worker/worker-travel', () => ({
  workerAssignmentIsValid: vi.fn(() => true),
  workerBeginReturnTrip: vi.fn(),
}));

vi.mock('@helpers/worker/worker-progression', () => ({
  workerGainXp: vi.fn(),
  workerStatsForLevel: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeGathering: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-gathering', () => ({
  gatheringResultsAtLevel: vi.fn((gathering) => gathering.gatherResults),
}));

vi.mock('@helpers/world-node/world-node-level', () => ({
  worldNodeLevel: vi.fn(() => 0),
}));

import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  workerGatherRate,
  workerGatherXpGateSatisfied,
  workerGatheringProcessTick,
} from '@helpers/worker/worker-gathering';
import {
  workerAssignmentIsValid,
  workerBeginReturnTrip,
} from '@helpers/worker/worker-travel';
import {
  workerGainXp,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  GameState,
  GatheringContent,
  ItemId,
  WorkerContent,
  WorkerId,
  WorkerState,
} from '@interfaces';

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

const WORKER_ID = 'weaver-nell' as WorkerId;
const COPPER_ID = 'copper-ore' as ItemId;
const MALACHITE_ID = 'malachite' as ItemId;

const workerContent: WorkerContent = {
  id: WORKER_ID,
  name: 'Weaver Nell',
  __type: 'worker',
  description: 'test',
  sprite: '0000',
  frames: 4,
  baseStats: { capacity: 6, gatherSpeed: 2, stamina: 30 },
  statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 2 },
};

function buildGathering(overrides: Partial<GatheringContent> = {}): GatheringContent {
  return {
    id: 'gathering-1' as never,
    name: 'Wergen Woods',
    __type: 'gathering',
    description: 'test',
    levelRange: { min: 1, max: 10 },
    xpGainedIfInLevelRange: 5,
    gatherTime: 10,
    gatherResults: [
      { chance: 80, items: [{ itemId: COPPER_ID, quantity: 1 }] },
      { chance: 20, items: [{ itemId: MALACHITE_ID, quantity: 1 }] },
    ],
    hidden: false,
    workerLevelRange: { min: 1, max: 999 },
    ...overrides,
  };
}

describe('workerGatherRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scales gatherSpeed by the item share of the weighted table', () => {
    vi.mocked(workerStatsForLevel).mockReturnValue({
      capacity: 6,
      gatherSpeed: 2,
      stamina: 30,
    });

    const gathering = buildGathering();

    // Copper is 80/100 of the table weight, so its rate is 80% of gatherSpeed.
    expect(workerGatherRate(workerContent, 1, gathering, COPPER_ID, 0)).toBe(
      1.6,
    );
    // Malachite is rarer (20/100), so it's gathered proportionally slower.
    expect(
      workerGatherRate(workerContent, 1, gathering, MALACHITE_ID, 0),
    ).toBe(0.4);
  });

  it('is 0 for an item not present in the gather table', () => {
    vi.mocked(workerStatsForLevel).mockReturnValue({
      capacity: 6,
      gatherSpeed: 2,
      stamina: 30,
    });

    const gathering = buildGathering();

    expect(
      workerGatherRate(
        workerContent,
        1,
        gathering,
        'unknown-item' as ItemId,
        0,
      ),
    ).toBe(0);
  });

  it('restricts the weighted table to results available at the given node level', () => {
    vi.mocked(workerStatsForLevel).mockReturnValue({
      capacity: 6,
      gatherSpeed: 2,
      stamina: 30,
    });
    vi.mocked(gatheringResultsAtLevel).mockReturnValueOnce([
      { chance: 80, items: [{ itemId: COPPER_ID, quantity: 1 }] },
    ]);

    const gathering = buildGathering();

    expect(workerGatherRate(workerContent, 1, gathering, COPPER_ID, 2)).toBe(
      2,
    );
    expect(gatheringResultsAtLevel).toHaveBeenCalledWith(gathering, 2);
  });
});

describe('workerGatherXpGateSatisfied', () => {
  it('is true within the workerLevelRange window', () => {
    const gathering = buildGathering({ workerLevelRange: { min: 5, max: 10 } });

    expect(workerGatherXpGateSatisfied(gathering, 4)).toBe(false);
    expect(workerGatherXpGateSatisfied(gathering, 5)).toBe(true);
    expect(workerGatherXpGateSatisfied(gathering, 10)).toBe(true);
    expect(workerGatherXpGateSatisfied(gathering, 11)).toBe(false);
  });
});

describe('workerGatheringProcessTick', () => {
  function buildWorker(overrides: Partial<WorkerState> = {}): WorkerState {
    return {
      level: 1,
      xp: { current: 0, maximum: 10 },
      location: { mapName: 'Carrina', x: 0, y: 0 },
      status: {
        kind: 'Gathering',
        nodeName: 'Wergen Woods',
        itemId: COPPER_ID,
        itemsGathered: 0,
        ticksIntoGather: 0,
      },
      assignment: { nodeName: 'Wergen Woods', itemId: COPPER_ID },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workerAssignmentIsValid).mockReturnValue(true);
    vi.mocked(worldNodeByName).mockReturnValue({} as never);
    vi.mocked(worldNodeGathering).mockReturnValue(
      buildGathering({ gatherTime: 10 }),
    );
    vi.mocked(getEntry).mockReturnValue(workerContent);
    vi.mocked(workerStatsForLevel).mockReturnValue({
      capacity: 6,
      gatherSpeed: 2,
      stamina: 30,
    });
  });

  it('accumulates ticksIntoGather without completing a unit early', () => {
    vi.mocked(gamestate).mockReturnValue({
      workers: { [WORKER_ID]: buildWorker() },
    } as unknown as GameState);

    workerGatheringProcessTick(WORKER_ID);

    const result = applyLastUpdate({
      workers: { [WORKER_ID]: buildWorker() },
    } as unknown as GameState);

    expect(worldNodeLevel).toHaveBeenCalledWith('Wergen Woods');
    expect(result.workers[WORKER_ID].status).toMatchObject({
      kind: 'Gathering',
      ticksIntoGather: 1,
      itemsGathered: 0,
    });
    expect(workerGainXp).not.toHaveBeenCalled();
  });

  it('completes a unit, grants xp, and resets ticksIntoGather once the rate threshold is hit', () => {
    // gatherTime 10 / rate (2 * 80/100 = 1.6) = 6.25 ticks per unit.
    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [WORKER_ID]: buildWorker({
          status: {
            kind: 'Gathering',
            nodeName: 'Wergen Woods',
            itemId: COPPER_ID,
            itemsGathered: 0,
            ticksIntoGather: 6,
          },
        }),
      },
    } as unknown as GameState);

    workerGatheringProcessTick(WORKER_ID);

    const result = applyLastUpdate({
      workers: {
        [WORKER_ID]: buildWorker({
          status: {
            kind: 'Gathering',
            nodeName: 'Wergen Woods',
            itemId: COPPER_ID,
            itemsGathered: 0,
            ticksIntoGather: 6,
          },
        }),
      },
    } as unknown as GameState);

    expect(workerGainXp).toHaveBeenCalledWith(WORKER_ID, 1);
    expect(result.workers[WORKER_ID].status).toMatchObject({
      kind: 'Gathering',
      itemsGathered: 1,
      ticksIntoGather: 0,
    });
  });

  it('begins the return trip once capacity is reached instead of resetting the cycle', () => {
    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [WORKER_ID]: buildWorker({
          status: {
            kind: 'Gathering',
            nodeName: 'Wergen Woods',
            itemId: COPPER_ID,
            itemsGathered: 5,
            ticksIntoGather: 6,
          },
        }),
      },
    } as unknown as GameState);

    workerGatheringProcessTick(WORKER_ID);

    expect(workerBeginReturnTrip).toHaveBeenCalledWith(WORKER_ID, COPPER_ID, 6);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('abandons the gather and parks AtDuchy when the assignment goes stale', () => {
    vi.mocked(workerAssignmentIsValid).mockReturnValue(false);
    vi.mocked(gamestate).mockReturnValue({
      workers: { [WORKER_ID]: buildWorker() },
    } as unknown as GameState);

    workerGatheringProcessTick(WORKER_ID);

    const result = applyLastUpdate({
      workers: { [WORKER_ID]: buildWorker() },
    } as unknown as GameState);

    expect(result.workers[WORKER_ID].status).toEqual({ kind: 'AtDuchy' });
    expect(result.workers[WORKER_ID].assignment).toBeNull();
  });
});
