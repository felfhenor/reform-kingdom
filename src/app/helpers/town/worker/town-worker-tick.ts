import { getEntriesByType } from '@helpers/content/content';
import { gamestate } from '@helpers/state-game';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import { townWorkerAutoAssign } from '@helpers/town/worker/town-worker-auto-assign';
import { townWorkerGatheringProcessTick } from '@helpers/town/worker/town-worker-gathering';
import {
  townWorkerRestProcessTick,
  townWorkerTravelProcessTick,
} from '@helpers/town/worker/town-worker-travel-tick';
import type { TownContent, WorkerId } from '@interfaces';

// Runs every tick once activated - worker travel/gathering progress continuously.
// Raising this is a blunt slowdown on the whole worker economy - it advances per-tick progress by +1 regardless of how many real ticks elapsed since the last run.
const WORKER_TICK_INTERVAL = 1;

function processTownWorker(town: TownContent, workerId: WorkerId): void {
  const worker = gamestate().world.towns[town.id]?.workers[workerId];
  if (!worker) return;

  switch (worker.status.kind) {
    case 'AtTown':
      if (!worker.assignment) {
        townWorkerAutoAssign(town, workerId, worker.level);
      }
      return;
    case 'TravelingTo':
    case 'TravelingBack':
      townWorkerTravelProcessTick(town, workerId);
      return;
    case 'Gathering':
      townWorkerGatheringProcessTick(town, workerId);
      return;
    case 'Resting':
      townWorkerRestProcessTick(town, workerId);
      return;
  }
}

export function townWorkerProcessTick(): void {
  getEntriesByType<TownContent>('town').forEach((town) => {
    if (!isTownDueForUpdate(town.id, 'worker', WORKER_TICK_INTERVAL)) return;

    const workers = gamestate().world.towns[town.id]?.workers ?? {};
    (Object.keys(workers) as WorkerId[]).forEach((workerId) => {
      processTownWorker(town, workerId);
    });

    markTownSubsystemProcessed(town.id, 'worker');
  });
}
