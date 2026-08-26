import { getEntry } from '@helpers/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifySuccess } from '@helpers/engine/notify';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  GameStateDiscoveredWorkers,
  GameStateWorkers,
  WorkerAssignment,
  WorkerContent,
  WorkerId,
} from '@interfaces';

export function isWorkerRescued(workerId: WorkerId): boolean {
  return !!gamestate().discoveredWorkers[workerId]?.foundAt;
}

// Content-existence check (not gamestate) - used as migrate.ts's `workerExists` predicate.
export function isWorkerContentKnown(workerId: WorkerId): boolean {
  return !!getEntry<WorkerContent>(workerId);
}

// Always unconditionally (re)initializes state - idempotency is combat-rewards.ts's job.
export function workerRescue(workerId: WorkerId): void {
  const worker = getEntry<WorkerContent>(workerId);
  if (!worker) return;

  updateGamestate((state) => {
    state.discoveredWorkers[workerId] = { foundAt: Date.now() };
    state.workers[workerId] = defaultWorkerState();
    return state;
  });

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

export function pruneInvalidDiscoveredWorkers(
  discovered: GameStateDiscoveredWorkers,
  workerExists: (workerId: WorkerId) => boolean,
): GameStateDiscoveredWorkers {
  const pruned: GameStateDiscoveredWorkers = {};

  (Object.keys(discovered) as WorkerId[]).forEach((workerId) => {
    if (workerExists(workerId)) {
      pruned[workerId] = discovered[workerId];
    }
  });

  return pruned;
}

// Parks a worker back at the Duchy if its stored/in-flight assignment no longer resolves.
// Takes `assignmentValid` as a param (not imported directly) to avoid a worker-travel.ts import cycle.
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
