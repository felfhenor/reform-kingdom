import type { Signal } from '@angular/core';
import { computed } from '@angular/core';
import { travelStepTicksCost } from '@helpers/hero/travel';
import { gamestate } from '@helpers/state-game';
import type { TravelStep, WorkerId } from '@interfaces';
import { clamp, sum } from 'es-toolkit/compat';

// Remaining ticks for a TravelingTo/TravelingBack worker, else undefined - drives the
// "mm:ss remaining" status line.
export function workerTravelRemainingTicks(
  workerId: WorkerId,
): number | undefined {
  const worker = gamestate().workers[workerId];
  if (!worker) return undefined;
  if (
    worker.status.kind !== 'TravelingTo' &&
    worker.status.kind !== 'TravelingBack'
  ) {
    return undefined;
  }

  const { path, ticksIntoStep } = worker.status;
  let origin = worker.location;

  const costs = path.map((step, index) => {
    const cost = travelStepTicksCost(step, origin);
    origin = { mapName: step.mapName, x: step.x, y: step.y };
    return index === 0 ? clamp(cost - ticksIntoStep, 0, cost) : cost;
  });

  return sum(costs);
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
  const workers = gamestate().workers;

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
