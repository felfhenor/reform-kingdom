import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  workerCraftAssignmentIsValid,
  workerStopCrafting,
} from '@helpers/worker/worker-crafting';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { workerGatherNodeHasItem } from '@helpers/worker/worker-shared';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type {
  ItemId,
  WorkerAssignment,
  WorkerContent,
  WorkerGatherAssignment,
  WorkerId,
} from '@interfaces';

// One-way only - the return trip is never stamina-gated (deliberate design
// decision: stamina is a one-way "how far can this worker be sent" budget).
export function workerStaminaCostToNode(
  nodeName: string,
  allowTeleport = true,
): number | undefined {
  const kingdom = kingdomNodeGet();
  if (!kingdom) return undefined;

  const path = travelPathFrom(kingdom, nodeName, allowTeleport);
  if (!path) return undefined;

  return travelPathBaseTotalTicks(path, kingdom);
}

export function canWorkerReachNode(
  nodeName: string,
  stamina: number,
  allowTeleport = true,
): boolean {
  const cost = workerStaminaCostToNode(nodeName, allowTeleport);
  return cost !== undefined && cost <= stamina;
}

// Shared validity check for workerAssign/auto-redeploy/migrate.
export function workerAssignmentIsValid(
  workerId: WorkerId,
  level: number,
  assignment: WorkerAssignment,
): boolean {
  return 'recipeId' in assignment
    ? workerCraftAssignmentIsValid(workerId, level, assignment)
    : workerGatherAssignmentIsValid(workerId, level, assignment);
}

function workerGatherAssignmentIsValid(
  workerId: WorkerId,
  level: number,
  assignment: WorkerGatherAssignment,
): boolean {
  const content = getEntry<WorkerContent>(workerId);
  if (!content) return false;

  const stamina = workerStatsForLevel(content, level).stamina;

  return (
    isGatherNodeDiscovered(assignment.nodeName) &&
    workerGatherNodeHasItem(assignment.nodeName, assignment.itemId) &&
    canWorkerReachNode(assignment.nodeName, stamina, content.canUseTeleports)
  );
}

// Starts (or resumes, on auto-redeploy) an outbound trip, always computed fresh from the
// Kingdom. No-ops (leaves the worker AtDuchy) if no route resolves.
export function workerBeginOutboundTrip(
  workerId: WorkerId,
  assignment: WorkerGatherAssignment,
): void {
  const kingdom = kingdomNodeGet();
  if (!kingdom) return;

  const canUseTeleports =
    getEntry<WorkerContent>(workerId)?.canUseTeleports ?? true;
  const path = travelPathFrom(kingdom, assignment.nodeName, canUseTeleports);
  if (!path) return;

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.status = {
      kind: 'TravelingTo',
      nodeName: assignment.nodeName,
      itemId: assignment.itemId,
      path,
      ticksIntoStep: 0,
    };

    return state;
  });
}

// Starts a return trip from the worker's current location, recomputed fresh each time.
// `carriedItemId`/`carriedQuantity` is whatever was gathered so far - XP is already granted per-unit.
// Returns whether a route home resolved - false means the worker was parked `AtDuchy` with its cargo discarded instead.
export function workerBeginReturnTrip(
  workerId: WorkerId,
  carriedItemId: ItemId | undefined,
  carriedQuantity: number,
): boolean {
  const worker = gamestate().workers[workerId];
  const kingdom = kingdomNodeGet();
  const canUseTeleports =
    getEntry<WorkerContent>(workerId)?.canUseTeleports ?? true;

  const path =
    worker && kingdom
      ? travelPathFrom(worker.location, kingdom.nodeName, canUseTeleports)
      : undefined;

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    // No route home resolves - park in place rather than leaving the worker stuck.
    target.status = path
      ? {
          kind: 'TravelingBack',
          path,
          ticksIntoStep: 0,
          carriedItemId,
          carriedQuantity,
        }
      : { kind: 'AtDuchy' };

    return state;
  });

  return !!path;
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

  // Only kicks off a trip immediately if the worker is at the Duchy -
  // changing assignment mid-trip takes effect on the next loop, not this one.
  if (worker.status.kind === 'AtDuchy' || worker.status.kind === 'Crafting') {
    workerBeginOutboundTrip(workerId, assignment);
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
    const carriedItemId =
      status.kind === 'Gathering' ? status.itemId : undefined;
    const carriedQuantity =
      status.kind === 'Gathering' ? status.itemsGathered : 0;

    workerBeginReturnTrip(workerId, carriedItemId, carriedQuantity);
  }

  const workerName = getEntry<WorkerContent>(workerId)?.name;
  analyticsSendDesignEvent(
    workerName
      ? `Worker:Recall:${analyticsSafeSegment(workerName)}`
      : 'Worker:Recall',
  );
}
