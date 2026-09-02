import { getEntry } from '@helpers/content';
import { gamestate } from '@helpers/state-game';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  TownContent,
  TownGatheringWorker,
  TownId,
  TownWorkerRosterEntry,
  TownWorkerState,
  TownWorkerStatus,
  TownWorkerStatusDisplay,
  WorkerContent,
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

export function townWorkerRosterEntries(
  townId: TownId,
): TownWorkerRosterEntry[] {
  const workers = gamestate().world.towns[townId]?.workers ?? {};

  return (Object.keys(workers) as WorkerId[])
    .map((workerId) => {
      const content = getEntry<WorkerContent>(workerId);
      if (!content) return undefined;

      const state = workers[workerId];
      return {
        workerId,
        name: content.name,
        sprite: content.sprite,
        frames: content.frames,
        level: state.level,
        status: state.status,
      };
    })
    .filter((entry): entry is TownWorkerRosterEntry => !!entry);
}

// Mirrors entryStatusDisplay's shape from the player Worker system - a label plus the node the worker is currently at (or heading to/returning to).
export function townWorkerStatusDisplay(
  town: TownContent,
  status: TownWorkerStatus,
): TownWorkerStatusDisplay {
  const atTownEntry = worldNodeByName(town.name);

  switch (status.kind) {
    case 'TravelingTo':
      return {
        label: `Traveling to ${status.nodeName}`,
        locationEntry: worldNodeByName(status.nodeName),
      };
    case 'Gathering':
      return {
        label: `Gathering at ${status.nodeName}`,
        locationEntry: worldNodeByName(status.nodeName),
      };
    case 'Resting':
      return { label: 'Resting', locationEntry: atTownEntry };
    case 'TravelingBack':
      return { label: 'Returning to town', locationEntry: atTownEntry };
    case 'AtTown':
      return { label: 'At Town', locationEntry: atTownEntry };
  }
}
