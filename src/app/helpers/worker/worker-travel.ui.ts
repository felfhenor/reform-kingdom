import type { Signal } from '@angular/core';
import { computed } from '@angular/core';
import { workersState } from '@helpers/state-game';
import type { AnyWorkerState, WorkerId, WorkerTravelToken } from '@interfaces';

export function anyWorkerTravelToken(
  key: string,
  workerId: WorkerId,
  worker: AnyWorkerState,
): WorkerTravelToken | undefined {
  const { status } = worker;
  if (status.kind !== 'TravelingTo' && status.kind !== 'TravelingBack') {
    return undefined;
  }

  return {
    key,
    workerId,
    location: worker.location,
    path: status.path,
    ticksIntoStep: status.ticksIntoStep,
  };
}

// Read every animation frame by the PIXI map-rendering layer - memoized so an unchanged
// gamestate reuses the same array instead of rebuilding it from all workers each frame.
export const workersTravelingTokens: Signal<WorkerTravelToken[]> = computed(
  () => {
    const workers = workersState();

    return (Object.keys(workers) as WorkerId[])
      .map((workerId) =>
        anyWorkerTravelToken(workerId, workerId, workers[workerId]),
      )
      .filter((token): token is WorkerTravelToken => !!token);
  },
);
