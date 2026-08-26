import { gamestate } from '@helpers/state-game';
import { workerGatheringProcessTick } from '@helpers/worker/worker-gathering';
import { workerTravelProcessTick } from '@helpers/worker/worker-travel-tick';
import type { WorkerId } from '@interfaces';

export function workersProcessTick(): void {
  const workers = gamestate().workers;

  (Object.keys(workers) as WorkerId[]).forEach((workerId) => {
    const status = workers[workerId]?.status.kind;

    if (status === 'TravelingTo' || status === 'TravelingBack') {
      workerTravelProcessTick(workerId);
      return;
    }

    if (status === 'Gathering') {
      workerGatheringProcessTick(workerId);
    }
  });
}
