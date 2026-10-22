import { TOWN_WORKER_REST_TICKS } from '@helpers/config';
import { updateGamestate, worldTownsState } from '@helpers/state-game';
import type { TownContent, WorkerId } from '@interfaces';

// Resting bridges a completed haul-back and the next auto-assignment - a brief idle cooldown at town, not a trip.
export function townWorkerRestProcessTick(
  town: TownContent,
  workerId: WorkerId,
): void {
  const worker = worldTownsState()[town.id]?.workers[workerId];
  if (!worker || worker.status.kind !== 'Resting') return;

  const ticksIntoRest = worker.status.ticksIntoRest + 1;

  updateGamestate((state) => {
    const target = state.world.towns[town.id]?.workers[workerId];
    if (!target) return state;

    if (target.status.kind !== 'Resting') return state;

    target.status =
      ticksIntoRest < TOWN_WORKER_REST_TICKS
        ? { kind: 'Resting', ticksIntoRest }
        : { kind: 'AtTown' };

    return state;
  });
}
