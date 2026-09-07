import type { Signal } from '@angular/core';
import { computed } from '@angular/core';
import { gamestate } from '@helpers/state-game';
import type { TownId, TravelStep, WorkerId } from '@interfaces';

// Read every animation frame by the PIXI map-rendering layer - a separate signal
// (not a merged one) since state lives at world.towns[townId].workers, not workers.
export const townWorkersTravelingTokens: Signal<
  {
    townId: TownId;
    workerId: WorkerId;
    mapName: string;
    path: TravelStep[];
    ticksIntoStep: number;
  }[]
> = computed(() => {
  const towns = gamestate().world.towns;

  return (Object.keys(towns) as TownId[]).flatMap((townId) => {
    const workers = towns[townId].workers;

    return (Object.keys(workers) as WorkerId[])
      .map((workerId) => {
        const worker = workers[workerId];
        if (
          worker.status.kind !== 'TravelingTo' &&
          worker.status.kind !== 'TravelingBack'
        ) {
          return undefined;
        }

        return {
          townId,
          workerId,
          mapName: worker.location.mapName,
          path: worker.status.path,
          ticksIntoStep: worker.status.ticksIntoStep,
        };
      })
      .filter((token): token is NonNullable<typeof token> => !!token);
  });
});
