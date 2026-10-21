import type { Signal } from '@angular/core';
import { computed } from '@angular/core';
import { worldTownsState } from '@helpers/state-game';
import { anyWorkerTravelToken } from '@helpers/worker/worker-travel.ui';
import type { TownId, WorkerId, WorkerTravelToken } from '@interfaces';

// Keyed by townId too, since content could reuse a worker id across towns.
export const townWorkersTravelingTokens: Signal<WorkerTravelToken[]> = computed(
  () => {
    const towns = worldTownsState();

    return (Object.keys(towns) as TownId[]).flatMap((townId) => {
      const workers = towns[townId].workers;

      return (Object.keys(workers) as WorkerId[])
        .map((workerId) =>
          anyWorkerTravelToken(
            `${townId}:${workerId}`,
            workerId,
            workers[workerId],
          ),
        )
        .filter((token): token is WorkerTravelToken => !!token);
    });
  },
);
