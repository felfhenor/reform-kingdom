import { getEntry } from '@helpers/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { travelPathTotalTicks, travelStepTicksCost } from '@helpers/hero/travel';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  kingdomNodeGet,
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  ItemId,
  TravelStep,
  WorkerAssignment,
  WorkerContent,
  WorkerId,
} from '@interfaces';
import { clamp, sum } from 'es-toolkit/compat';

function gatherNodeHasItem(nodeName: string, itemId: ItemId): boolean {
  const node = worldNodeByName(nodeName);
  if (!node) return false;

  const gathering = worldNodeGathering(node);
  if (!gathering) return false;

  return gatheringResultsAtLevel(gathering, worldNodeLevel(nodeName)).some(
    (result) => result.items.some((item) => item.itemId === itemId),
  );
}

// One-way only - the return trip is never stamina-gated (deliberate design
// decision: stamina is a one-way "how far can this worker be sent" budget).
export function workerStaminaCostToNode(nodeName: string): number | undefined {
  const kingdom = kingdomNodeGet();
  if (!kingdom) return undefined;

  const path = travelPathFrom(kingdom, nodeName);
  if (!path) return undefined;

  return travelPathTotalTicks(path, kingdom);
}

export function canWorkerReachNode(nodeName: string, stamina: number): boolean {
  const cost = workerStaminaCostToNode(nodeName);
  return cost !== undefined && cost <= stamina;
}

// Shared validity check for workerAssign/auto-redeploy/migrate. Takes `level`
// explicitly so migrate.ts can validate against its in-progress state, not the live gamestate.
export function workerAssignmentIsValid(
  workerId: WorkerId,
  level: number,
  assignment: WorkerAssignment,
): boolean {
  const content = getEntry<WorkerContent>(workerId);
  if (!content) return false;

  const stamina = workerStatsForLevel(content, level).stamina;

  return (
    isGatherNodeDiscovered(assignment.nodeName) &&
    gatherNodeHasItem(assignment.nodeName, assignment.itemId) &&
    canWorkerReachNode(assignment.nodeName, stamina)
  );
}

// Starts (or resumes, on auto-redeploy) an outbound trip, always computed fresh from the
// Kingdom. No-ops (leaves the worker AtDuchy) if no route resolves.
export function workerBeginOutboundTrip(
  workerId: WorkerId,
  assignment: WorkerAssignment,
): void {
  const kingdom = kingdomNodeGet();
  if (!kingdom) return;

  const path = travelPathFrom(kingdom, assignment.nodeName);
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
export function workerBeginReturnTrip(
  workerId: WorkerId,
  carriedItemId: ItemId | undefined,
  carriedQuantity: number,
): void {
  const worker = gamestate().workers[workerId];
  const kingdom = kingdomNodeGet();

  const path = worker && kingdom
    ? travelPathFrom(worker.location, kingdom.nodeName)
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

  const assignment: WorkerAssignment = { nodeName, itemId };
  if (!workerAssignmentIsValid(workerId, worker.level, assignment)) return false;

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.assignment = assignment;
    return state;
  });

  // Only kicks off a trip immediately if the worker is idle at the Duchy -
  // changing assignment mid-trip takes effect on the next loop, not this one.
  if (worker.status.kind === 'AtDuchy') {
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

// Always safe to clear the assignment. Only TravelingTo/Gathering actually get
// interrupted - the UI hides Recall for TravelingBack/AtDuchy.
export function workerRecall(workerId: WorkerId): void {
  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.assignment = null;
    return state;
  });

  const worker = gamestate().workers[workerId];
  if (!worker) return;
  if (worker.status.kind === 'TravelingBack' || worker.status.kind === 'AtDuchy') {
    return;
  }

  const carriedItemId =
    worker.status.kind === 'Gathering' ? worker.status.itemId : undefined;
  const carriedQuantity =
    worker.status.kind === 'Gathering' ? worker.status.itemsGathered : 0;

  workerBeginReturnTrip(workerId, carriedItemId, carriedQuantity);

  const workerName = getEntry<WorkerContent>(workerId)?.name;
  analyticsSendDesignEvent(
    workerName
      ? `Worker:Recall:${analyticsSafeSegment(workerName)}`
      : 'Worker:Recall',
  );
}

// Remaining ticks for a TravelingTo/TravelingBack worker, else undefined - drives the
// "mm:ss remaining" status line, same math as the party's travelEtaSecondsTo.
export function workerTravelRemainingTicks(workerId: WorkerId): number | undefined {
  const worker = gamestate().workers[workerId];
  if (!worker) return undefined;
  if (worker.status.kind !== 'TravelingTo' && worker.status.kind !== 'TravelingBack') {
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

// Read by the PIXI map-rendering layer to know which workers need a visible
// token right now, and where their in-progress step is.
export function workersTravelingTokens(): {
  workerId: WorkerId;
  mapName: string;
  path: TravelStep[];
  ticksIntoStep: number;
}[] {
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
}
