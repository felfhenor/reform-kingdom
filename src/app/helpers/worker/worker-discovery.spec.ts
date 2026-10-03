import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { ensureWorker } from '@helpers/content/ensure-worker';
import { workersState } from '@helpers/state-game';
import { taskEventWorkerRescued } from '@helpers/task/task-events';
import {
  isWorkerContentKnown,
  isWorkerRescued,
  pruneInvalidDiscoveredWorkers,
  pruneInvalidWorkerStates,
  workerRescue,
} from '@helpers/worker/worker-discovery';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  ItemId,
  WorkerAssignment,
  WorkerId,
  WorkerState,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { captureNotifications } from '@/testing/notify';

const nell = ensureWorker({
  id: 'weaver-nell' as WorkerId,
  name: 'Weaver Nell',
});
const assignment: WorkerAssignment = {
  nodeName: 'Wergen Woods',
  itemId: 'copper-ore' as ItemId,
};

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([nell]);
});

describe('workerRescue', () => {
  it('rescues a fresh worker at the Duchy, announcing it', () => {
    seedGamestate();
    const events = captureAnalyticsEvents();
    const notifications = captureNotifications();

    inTick(() => workerRescue(nell.id));

    expect(isWorkerContentKnown(nell.id)).toBe(true);
    expect(isWorkerRescued(nell.id)).toBe(true);
    expect(workersState()[nell.id]).toEqual(defaultWorkerState());
    expect(notifications.map((n) => n.message)).toEqual([
      expect.stringContaining('Weaver Nell'),
    ]);
    expect(events).toContain('Worker:Rescue:Weaver Nell');
    expect(taskEventWorkerRescued).toHaveBeenCalledWith(nell.id);
  });

  it('does nothing for a worker not in content', () => {
    seedGamestate();
    const gone = 'gone' as WorkerId;

    inTick(() => workerRescue(gone));

    expect(isWorkerContentKnown(gone)).toBe(false);
    expect(isWorkerRescued(gone)).toBe(false);
    expect(workersState()).toEqual({});
  });
});

describe('pruneInvalidDiscoveredWorkers', () => {
  it('keeps only workers the existence check accepts', () => {
    expect(
      pruneInvalidDiscoveredWorkers(
        {
          [nell.id]: { foundAt: 1000 },
          ['removed' as WorkerId]: { foundAt: 2000 },
        },
        (workerId) => workerId === nell.id,
      ),
    ).toEqual({ [nell.id]: { foundAt: 1000 } });
  });
});

describe('pruneInvalidWorkerStates', () => {
  const gathering: WorkerState['status'] = {
    kind: 'Gathering',
    ...assignment,
    itemsGathered: 2,
    ticksIntoGather: 0,
  };

  function pruned(worker: Partial<WorkerState>, valid: boolean): WorkerState {
    const state = { ...defaultWorkerState(), ...worker };
    return pruneInvalidWorkerStates({ [nell.id]: state }, () => valid)[nell.id];
  }

  it('keeps a worker whose assignment and current trip still resolve', () => {
    const worker = { assignment, status: gathering };

    expect(pruned(worker, true)).toMatchObject(worker);
  });

  it('parks the worker at the Duchy when its assignment or current trip went stale', () => {
    const traveling: WorkerState['status'] = {
      kind: 'TravelingTo',
      ...assignment,
      path: [],
      ticksIntoStep: 0,
    };

    [{ assignment }, { status: gathering }, { status: traveling }].forEach(
      (worker) => {
        expect(pruned(worker, false)).toMatchObject({
          status: { kind: 'AtDuchy' },
          assignment: null,
        });
      },
    );
  });
});
