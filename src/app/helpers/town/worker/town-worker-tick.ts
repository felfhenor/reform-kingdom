import { WORKER_TICK_INTERVAL } from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import { worldTownsState } from '@helpers/state-game';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import { townWorkerAutoAssign } from '@helpers/town/worker/town-worker-auto-assign';
import { townWorkerRestProcessTick } from '@helpers/town/worker/town-worker-travel-tick';
import { townWorkerTripHost } from '@helpers/town/worker/town-worker-trip';
import {
  workerTripGatheringTick,
  workerTripTravelTick,
} from '@helpers/worker/worker-trip';
import type { TownContent, WorkerId } from '@interfaces';

function processTownWorker(town: TownContent, workerId: WorkerId): void {
  const worker = worldTownsState()[town.id]?.workers[workerId];
  if (!worker) return;

  switch (worker.status.kind) {
    case 'AtTown':
      if (!worker.assignment) {
        townWorkerAutoAssign(town, workerId, worker.level);
      }
      return;
    case 'TravelingTo':
    case 'TravelingBack':
      workerTripTravelTick(townWorkerTripHost(town, workerId));
      return;
    case 'Gathering':
      workerTripGatheringTick(townWorkerTripHost(town, workerId));
      return;
    case 'Resting':
      townWorkerRestProcessTick(town, workerId);
      return;
  }
}

export function townWorkerProcessTick(): void {
  getEntriesByType<TownContent>('town').forEach((town) => {
    if (!isTownDueForUpdate(town.id, 'worker', WORKER_TICK_INTERVAL)) return;

    const workers = worldTownsState()[town.id]?.workers ?? {};
    (Object.keys(workers) as WorkerId[]).forEach((workerId) => {
      processTownWorker(town, workerId);
    });

    markTownSubsystemProcessed(town.id, 'worker', WORKER_TICK_INTERVAL);
  });
}
