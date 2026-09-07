import { getEntry } from '@helpers/content/content';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import type {
  TownContent,
  TownGatheringWorker,
  TownId,
  TownWorkerState,
  WorkerId,
} from '@interfaces';

export function townWorkers(townId: TownId): TownGatheringWorker[] {
  return getEntry<TownContent>(townId)?.gathering.workers ?? [];
}

// Materializes state for any roster entry that doesn't have one yet - called on town activation.
export function townWorkerRosterMaterialize(
  town: TownContent,
  existing: Record<WorkerId, TownWorkerState>,
): Record<WorkerId, TownWorkerState> {
  const materialized: Record<WorkerId, TownWorkerState> = { ...existing };

  town.gathering.workers.forEach((worker) => {
    materialized[worker.workerId] ??= defaultTownWorkerState(
      town,
      worker.level,
    );
  });

  return materialized;
}

// Drops per-town worker state for any WorkerId no longer in the town's authored roster.
export function pruneInvalidTownWorkers(
  town: TownContent,
  workers: Record<WorkerId, TownWorkerState>,
): Record<WorkerId, TownWorkerState> {
  const validIds = new Set(town.gathering.workers.map((w) => w.workerId));
  const pruned: Record<WorkerId, TownWorkerState> = {};

  (Object.keys(workers) as WorkerId[]).forEach((workerId) => {
    if (validIds.has(workerId)) {
      pruned[workerId] = workers[workerId];
    }
  });

  return pruned;
}
