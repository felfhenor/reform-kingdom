import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { workerAssignmentIsValid } from '@helpers/worker/worker-assignment';
import { workerStopCrafting } from '@helpers/worker/worker-crafting';
import {
  workerTripBeginOutbound,
  workerTripBeginReturn,
} from '@helpers/worker/worker-trip';
import { kingdomWorkerTripHost } from '@helpers/worker/worker-trip-kingdom';
import type {
  ItemId,
  WorkerContent,
  WorkerGatherAssignment,
  WorkerId,
} from '@interfaces';

// Returns early ("not rescued") if `workers[workerId]` doesn't exist -
// there's nothing else to gate on, since an unrescued worker has no state.
export function workerAssign(
  workerId: WorkerId,
  nodeName: string,
  itemId: ItemId,
): boolean {
  const worker = gamestate().workers[workerId];
  if (!worker) return false;

  const assignment: WorkerGatherAssignment = { nodeName, itemId };
  if (!workerAssignmentIsValid(workerId, worker.level, assignment))
    return false;

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.assignment = assignment;
    workerStopCrafting(state, workerId);

    return state;
  });

  // Only kicks off a trip immediately if the worker is at the Duchy -
  // changing assignment mid-trip takes effect on the next loop, not this one.
  if (worker.status.kind === 'AtDuchy' || worker.status.kind === 'Crafting') {
    workerTripBeginOutbound(kingdomWorkerTripHost(workerId), assignment);
  }

  const workerName = getEntry<WorkerContent>(workerId)?.name;
  analyticsSendDesignEvent(
    workerName
      ? `Worker:Assign:${analyticsSafeSegment(workerName)}`
      : 'Worker:Assign',
  );
  return true;
}

// Always safe to clear the assignment. Crafting stops in place; only TravelingTo/Gathering start a trip home.
export function workerRecall(workerId: WorkerId): void {
  const worker = gamestate().workers[workerId];

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.assignment = null;
    workerStopCrafting(state, workerId);

    return state;
  });

  const status = worker?.status;
  if (!status || status.kind === 'TravelingBack' || status.kind === 'AtDuchy')
    return;

  if (status.kind !== 'Crafting') {
    const gathering = status.kind === 'Gathering';
    workerTripBeginReturn(kingdomWorkerTripHost(workerId), {
      itemId: gathering ? status.itemId : undefined,
      quantity: gathering ? status.itemsGathered : 0,
    });
  }

  const workerName = getEntry<WorkerContent>(workerId)?.name;
  analyticsSendDesignEvent(
    workerName
      ? `Worker:Recall:${analyticsSafeSegment(workerName)}`
      : 'Worker:Recall',
  );
}
