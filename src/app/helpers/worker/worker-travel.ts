import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { workerAssignmentIsValid } from '@helpers/worker/worker-assignment';
import { workerStopCrafting } from '@helpers/worker/worker-crafting';
import { workerGatheringStatusStart } from '@helpers/worker/worker-shared';
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
  WorkerStatus,
  WorkerStatusGathering,
  WorkerStatusTravelingTo,
  WorkerTripCargo,
} from '@interfaces';

function workerTripCargo(
  status: WorkerStatusTravelingTo | WorkerStatusGathering,
): WorkerTripCargo {
  return status.kind === 'Gathering'
    ? { itemId: status.itemId, quantity: status.itemsGathered }
    : { quantity: 0 };
}

// Same node with nothing carried just switches item in place.
function workerRetargetItem(workerId: WorkerId, itemId: ItemId): void {
  updateGamestate((state) => {
    const status = state.workers[workerId]?.status;
    if (status?.kind === 'TravelingTo') status.itemId = itemId;
    if (status?.kind === 'Gathering' && status.itemsGathered === 0) {
      state.workers[workerId].status = workerGatheringStatusStart(
        status.nodeName,
        itemId,
      );
    }
    return state;
  });
}

// A worker out on a different job turns back with any haul and picks the new one up once home.
function workerStartAssignment(
  workerId: WorkerId,
  status: WorkerStatus,
  assignment: WorkerGatherAssignment,
): void {
  const host = kingdomWorkerTripHost(workerId);
  if (status.kind === 'AtDuchy' || status.kind === 'Crafting') {
    workerTripBeginOutbound(host, assignment);
    return;
  }

  if (status.kind === 'TravelingBack') return;

  const sameNode = status.nodeName === assignment.nodeName;
  if (sameNode && status.itemId === assignment.itemId) return;

  const hasHaul = status.kind === 'Gathering' && status.itemsGathered > 0;
  if (sameNode && !hasHaul) {
    workerRetargetItem(workerId, assignment.itemId);
    return;
  }

  workerTripBeginReturn(host, workerTripCargo(status));
}

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

  workerStartAssignment(workerId, worker.status, assignment);

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
    workerTripBeginReturn(
      kingdomWorkerTripHost(workerId),
      workerTripCargo(status),
    );
  }

  const workerName = getEntry<WorkerContent>(workerId)?.name;
  analyticsSendDesignEvent(
    workerName
      ? `Worker:Recall:${analyticsSafeSegment(workerName)}`
      : 'Worker:Recall',
  );
}
