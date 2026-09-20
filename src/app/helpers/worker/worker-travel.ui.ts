import type { Signal } from '@angular/core';
import { computed } from '@angular/core';
import { travelTicksRemaining } from '@helpers/hero/travel-progress';
import { workersState } from '@helpers/state-game';
import type { TravelStep, WorkerId } from '@interfaces';

// Remaining ticks for a TravelingTo/TravelingBack worker, else undefined - drives the
// "mm:ss remaining" status line.
export function workerTravelRemainingTicks(
  workerId: WorkerId,
): number | undefined {
  const worker = workersState()[workerId];
  if (!worker) return undefined;
  if (
    worker.status.kind !== 'TravelingTo' &&
    worker.status.kind !== 'TravelingBack'
  ) {
    return undefined;
  }

  const { path, ticksIntoStep } = worker.status;

  return travelTicksRemaining(path, worker.location, ticksIntoStep);
}

// Read every animation frame by the PIXI map-rendering layer - memoized so an unchanged
// gamestate reuses the same array instead of rebuilding it from all workers each frame.
export const workersTravelingTokens: Signal<
  {
    workerId: WorkerId;
    mapName: string;
    path: TravelStep[];
    ticksIntoStep: number;
  }[]
> = computed(() => {
  const workers = workersState();

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
        workerId,
        mapName: worker.location.mapName,
        path: worker.status.path,
        ticksIntoStep: worker.status.ticksIntoStep,
      };
    })
    .filter((token): token is NonNullable<typeof token> => !!token);
});
