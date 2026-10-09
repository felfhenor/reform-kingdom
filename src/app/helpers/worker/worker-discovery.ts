import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import { notifySuccess } from '@helpers/engine/notify';
import { discoveredWorkersState, updateGamestate } from '@helpers/state-game';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  GameStateWorkers,
  WorkerAssignment,
  WorkerContent,
  WorkerId,
} from '@interfaces';
import { taskEventWorkerRescued } from '@helpers/task/task-events';

export function isWorkerRescued(workerId: WorkerId): boolean {
  return ledgerHas(discoveredWorkersState(), workerId);
}

// Content-existence check (not gamestate).
export function isWorkerContentKnown(workerId: WorkerId): boolean {
  return !!getEntry<WorkerContent>(workerId);
}

// Always (re)initializes the worker's progress state; the ledger keeps its first foundAt.
export function workerRescue(workerId: WorkerId): void {
  const worker = getEntry<WorkerContent>(workerId);
  if (!worker) return;

  updateGamestate((state) => {
    ledgerMark(state.discoveredWorkers, workerId);
    state.workers[workerId] = defaultWorkerState();
    return state;
  });

  void taskEventWorkerRescued(workerId);
  notifySuccess(`You rescued ${worker.name}!`);
  analyticsSendDesignEvent(
    `Worker:Rescue:${analyticsSafeSegment(worker.name)}`,
  );
}

// Debug tool: reverts a worker back to unrescued.
export function workerUndiscover(workerId: WorkerId): void {
  updateGamestate((state) => {
    delete state.discoveredWorkers[workerId];
    delete state.workers[workerId];
    return state;
  });
}

// Parks a worker back at the Duchy if its stored/in-flight assignment no longer resolves.
// Takes `assignmentValid` as a param (not imported directly).
export function pruneInvalidWorkerStates(
  workers: GameStateWorkers,
  assignmentValid: (
    workerId: WorkerId,
    level: number,
    assignment: WorkerAssignment,
  ) => boolean,
): GameStateWorkers {
  const pruned: GameStateWorkers = {};

  (Object.keys(workers) as WorkerId[]).forEach((workerId) => {
    const worker = workers[workerId];
    const inFlight: WorkerAssignment | undefined =
      worker.status.kind === 'TravelingTo' || worker.status.kind === 'Gathering'
        ? { nodeName: worker.status.nodeName, itemId: worker.status.itemId }
        : undefined;

    const isStale =
      (!!worker.assignment &&
        !assignmentValid(workerId, worker.level, worker.assignment)) ||
      (!!inFlight && !assignmentValid(workerId, worker.level, inFlight));

    pruned[workerId] = isStale
      ? { ...worker, status: { kind: 'AtDuchy' }, assignment: null }
      : worker;
  });

  return pruned;
}
