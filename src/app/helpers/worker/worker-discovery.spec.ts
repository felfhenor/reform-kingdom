import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSafeSegment: (value: string) => value.replace(/\s+/g, ''),
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/engine/notify', () => ({
  notifySuccess: vi.fn(),
}));

vi.mock('@helpers/worker/worker-progression', () => ({
  defaultWorkerState: vi.fn(() => ({
    level: 1,
    xp: { current: 0, maximum: 10 },
    location: { mapName: 'Carrina', x: 0, y: 0 },
    status: { kind: 'AtDuchy' },
    assignment: null,
  })),
}));

import { getEntry } from '@helpers/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { notifySuccess } from '@helpers/engine/notify';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  isWorkerRescued,
  pruneInvalidDiscoveredWorkers,
  pruneInvalidWorkerStates,
  workerRescue,
  workerUndiscover,
} from '@helpers/worker/worker-discovery';
import type {
  GameState,
  GameStateWorkers,
  WorkerAssignment,
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

const workerContent: WorkerContent = {
  id: WORKER_ID,
  name: 'Weaver Nell',
  __type: 'worker',
  description: 'test',
  sprite: '0000',
  frames: 4,
  baseStats: { capacity: 6, gatherSpeed: 1, stamina: 30 },
  statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 2 },
};

describe('isWorkerRescued', () => {
  it('is true once the worker has a foundAt timestamp', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredWorkers: { [WORKER_ID]: { foundAt: 1000 } },
    } as unknown as GameState);

    expect(isWorkerRescued(WORKER_ID)).toBe(true);
  });

  it('is false for a worker never rescued', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredWorkers: {},
    } as unknown as GameState);

    expect(isWorkerRescued(WORKER_ID)).toBe(false);
  });
});

describe('workerRescue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing if the worker content does not resolve', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    workerRescue(WORKER_ID);

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('records the ledger, initializes state, and notifies on rescue', () => {
    vi.mocked(getEntry).mockReturnValue(workerContent);

    workerRescue(WORKER_ID);

    const result = applyLastUpdate({
      discoveredWorkers: {},
      workers: {},
    } as unknown as GameState);

    expect(result.discoveredWorkers[WORKER_ID].foundAt).toEqual(
      expect.any(Number),
    );
    expect(result.workers[WORKER_ID]).toMatchObject({
      level: 1,
      status: { kind: 'AtDuchy' },
    });
    expect(notifySuccess).toHaveBeenCalledWith('You rescued Weaver Nell!');
    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Worker:Rescue:WeaverNell',
    );
  });
});

describe('workerUndiscover', () => {
  it('deletes both the ledger entry and the live state', () => {
    workerUndiscover(WORKER_ID);

    const result = applyLastUpdate({
      discoveredWorkers: { [WORKER_ID]: { foundAt: 1000 } },
      workers: { [WORKER_ID]: {} },
    } as unknown as GameState);

    expect(result.discoveredWorkers[WORKER_ID]).toBeUndefined();
    expect(result.workers[WORKER_ID]).toBeUndefined();
  });
});

describe('pruneInvalidDiscoveredWorkers', () => {
  it('keeps only entries the existence check accepts', () => {
    const discovered = {
      [WORKER_ID]: { foundAt: 1000 },
      'removed-worker': { foundAt: 2000 },
    } as unknown as Parameters<typeof pruneInvalidDiscoveredWorkers>[0];

    const result = pruneInvalidDiscoveredWorkers(
      discovered,
      (workerId) => workerId === WORKER_ID,
    );

    expect(result).toEqual({ [WORKER_ID]: { foundAt: 1000 } });
  });
});

describe('pruneInvalidWorkerStates', () => {
  function buildState(overrides: Partial<WorkerState>): WorkerState {
    return {
      level: 1,
      xp: { current: 0, maximum: 10 },
      location: { mapName: 'Carrina', x: 0, y: 0 },
      status: { kind: 'AtDuchy' },
      assignment: null,
      ...overrides,
    };
  }

  it('leaves a worker with a valid assignment untouched', () => {
    const assignment: WorkerAssignment = {
      nodeName: 'Wergen Woods',
      itemId: 'copper-ore' as never,
    };
    const workers: GameStateWorkers = {
      [WORKER_ID]: buildState({ assignment }),
    };

    const result = pruneInvalidWorkerStates(workers, () => true);

    expect(result[WORKER_ID]).toEqual(workers[WORKER_ID]);
  });

  it('parks AtDuchy and clears the assignment when it is stale', () => {
    const assignment: WorkerAssignment = {
      nodeName: 'Removed Node',
      itemId: 'copper-ore' as never,
    };
    const workers: GameStateWorkers = {
      [WORKER_ID]: buildState({ assignment }),
    };

    const result = pruneInvalidWorkerStates(workers, () => false);

    expect(result[WORKER_ID].status).toEqual({ kind: 'AtDuchy' });
    expect(result[WORKER_ID].assignment).toBeNull();
  });

  it('parks AtDuchy when the in-flight Gathering target is stale, even with no stored assignment', () => {
    const workers: GameStateWorkers = {
      [WORKER_ID]: buildState({
        assignment: null,
        status: {
          kind: 'Gathering',
          nodeName: 'Removed Node',
          itemId: 'copper-ore' as never,
          itemsGathered: 2,
          ticksIntoGather: 0,
        },
      }),
    };

    const result = pruneInvalidWorkerStates(workers, () => false);

    expect(result[WORKER_ID].status).toEqual({ kind: 'AtDuchy' });
  });
});
