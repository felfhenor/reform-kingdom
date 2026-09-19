import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { spendGold } from '@helpers/item/materials';
import { gamestate, updateGamestate, workersState } from '@helpers/state-game';
import {
  workerIsReadyToLevelUp,
  workerLevelUpCost,
  workerXpForLevel,
} from '@helpers/worker/worker-progression';
import { updateWorkerRecord } from '@helpers/worker/worker-record';
import type {
  WorkerContent,
  WorkerId,
  WorkerLevelUpStatusEntry,
} from '@interfaces';

// One entry per rescued worker ready to level up right now - built for the corner status indicator.
export function workersReadyToLevelUpEntries(): WorkerLevelUpStatusEntry[] {
  const workers = workersState();

  return (Object.keys(workers) as WorkerId[])
    .map((workerId) => {
      const worker = workers[workerId];
      if (!workerIsReadyToLevelUp(worker)) return undefined;

      const content = getEntry<WorkerContent>(workerId);
      if (!content) return undefined;

      return {
        workerId,
        name: content.name,
        sprite: content.sprite,
        frames: content.frames,
        level: worker.level,
      };
    })
    .filter((entry): entry is WorkerLevelUpStatusEntry => !!entry);
}

// Deliberately no location/travel-state check - a worker can be leveled up
// from anywhere, not just while parked at the Duchy.
export function workerLevelUp(workerId: WorkerId): boolean {
  const worker = gamestate().workers[workerId];
  if (!worker) return false;
  if (!workerIsReadyToLevelUp(worker)) return false;

  const cost = workerLevelUpCost(worker.level);

  updateGamestate((state) => {
    spendGold(state, cost);

    return updateWorkerRecord(state, workerId, (target) => {
      target.level += 1;
      target.xp = { current: 0, maximum: workerXpForLevel(target.level) };
    });
  });

  const workerName = getEntry<WorkerContent>(workerId)?.name;
  analyticsSendDesignEvent(
    workerName
      ? `Worker:LevelUp:${analyticsSafeSegment(workerName)}`
      : 'Worker:LevelUp',
  );
  return true;
}
