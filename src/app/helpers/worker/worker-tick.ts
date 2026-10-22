import { gamestate } from '@helpers/state-game';
import { workerCraftingProcessTick } from '@helpers/worker/worker-crafting';
import {
  workerTripGatheringTick,
  workerTripTravelTick,
} from '@helpers/worker/worker-trip';
import { kingdomWorkerTripHost } from '@helpers/worker/worker-trip-kingdom';
import type { WorkerId } from '@interfaces';

export function workersProcessTick(): void {
  const workers = gamestate().workers;

  (Object.keys(workers) as WorkerId[]).forEach((workerId) => {
    const status = workers[workerId]?.status.kind;

    if (status === 'TravelingTo' || status === 'TravelingBack') {
      workerTripTravelTick(kingdomWorkerTripHost(workerId));
      return;
    }

    if (status === 'Gathering') {
      workerTripGatheringTick(kingdomWorkerTripHost(workerId));
      return;
    }

    if (status === 'Crafting') {
      workerCraftingProcessTick(workerId);
    }
  });
}
