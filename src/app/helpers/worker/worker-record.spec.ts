import { defaultGameState } from '@helpers/defaults';
import { updateWorkerRecord } from '@helpers/worker/worker-record';
import type { GameState, WorkerId, WorkerState } from '@interfaces';
import { describe, expect, it } from 'vitest';

const WORKER_ID = 'weaver-nell' as WorkerId;
const OTHER_WORKER_ID = 'tinker-bo' as WorkerId;

function buildWorker(): WorkerState {
  return {
    level: 1,
    xp: { current: 0, maximum: 10 },
    location: { mapName: 'Carrina', x: 0, y: 0 },
    status: { kind: 'AtDuchy' },
    assignment: null,
  };
}

function buildState(): GameState {
  const state = defaultGameState();
  state.workers = {
    [WORKER_ID]: buildWorker(),
    [OTHER_WORKER_ID]: buildWorker(),
  };
  return state;
}

describe('updateWorkerRecord', () => {
  it('applies the mutation to the targeted worker', () => {
    const state = updateWorkerRecord(buildState(), WORKER_ID, (worker) => {
      worker.level = 5;
    });

    expect(state.workers[WORKER_ID].level).toBe(5);
  });

  it('replaces the workers dict and the touched record with fresh references', () => {
    const state = buildState();
    const previousWorkers = state.workers;
    const previousRecord = state.workers[WORKER_ID];

    updateWorkerRecord(state, WORKER_ID, (worker) => {
      worker.level = 5;
    });

    expect(state.workers).not.toBe(previousWorkers);
    expect(state.workers[WORKER_ID]).not.toBe(previousRecord);
  });

  it('leaves untouched workers reference-stable', () => {
    const state = buildState();
    const previousOther = state.workers[OTHER_WORKER_ID];

    updateWorkerRecord(state, WORKER_ID, (worker) => {
      worker.level = 5;
    });

    expect(state.workers[OTHER_WORKER_ID]).toBe(previousOther);
  });

  it('does not mutate the previous record', () => {
    const state = buildState();
    const previousRecord = state.workers[WORKER_ID];

    updateWorkerRecord(state, WORKER_ID, (worker) => {
      worker.level = 5;
    });

    expect(previousRecord.level).toBe(1);
  });

  it('leaves state untouched when the worker does not exist', () => {
    const state = buildState();
    const previousWorkers = state.workers;

    updateWorkerRecord(state, 'missing' as WorkerId, (worker) => {
      worker.level = 5;
    });

    expect(state.workers).toBe(previousWorkers);
  });
});
