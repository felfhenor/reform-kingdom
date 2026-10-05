import { getEntry } from '@helpers/content/content';
import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { updateGamestate } from '@helpers/state-game';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { workerGatherNodeHasItem } from '@helpers/worker/worker-shared';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  ItemId,
  TownContent,
  TownId,
  TownWorkerAssignment,
  WorkerContent,
  WorkerId,
} from '@interfaces';

// Cost from the town's own node, not the Kingdom; NPC workers never use the player's outposts.
export function townWorkerStaminaCostToNode(
  town: TownContent,
  nodeName: string,
  allowTeleport = true,
): number | undefined {
  const townNode = worldNodeByName(town.name);
  if (!townNode) return undefined;

  const path = travelPathFrom(
    townNode,
    nodeName,
    allowTeleport,
    false,
    false,
    'None',
  );
  return path ? travelPathBaseTotalTicks(path, townNode) : undefined;
}

// No discovery check - town workers are NPC-run, not player exploration.
export function townWorkerAssignmentIsValid(
  town: TownContent,
  workerId: WorkerId,
  level: number,
  assignment: TownWorkerAssignment,
): boolean {
  const content = getEntry<WorkerContent>(workerId);
  if (!content) return false;

  const stamina = workerStatsForLevel(content, level).stamina;
  const cost = townWorkerStaminaCostToNode(
    town,
    assignment.nodeName,
    content.canUseTeleports,
  );

  return (
    workerGatherNodeHasItem(assignment.nodeName, assignment.itemId) &&
    cost !== undefined &&
    cost <= stamina
  );
}

// Always computed fresh from the town's own node - no-ops (leaves the worker AtTown) if no route resolves.
export function townWorkerBeginOutboundTrip(
  townId: TownId,
  town: TownContent,
  workerId: WorkerId,
  assignment: TownWorkerAssignment,
): void {
  const townNode = worldNodeByName(town.name);
  if (!townNode) return;

  const canUseTeleports =
    getEntry<WorkerContent>(workerId)?.canUseTeleports ?? true;
  const path = travelPathFrom(
    townNode,
    assignment.nodeName,
    canUseTeleports,
    false,
    false,
    'None',
  );
  if (!path) return;

  updateGamestate((state) => {
    const target = state.world.towns[townId]?.workers[workerId];
    if (!target) return state;

    target.assignment = assignment;
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

// Starts the trip home from the worker's current location - parks AtTown with cargo discarded if no route resolves.
export function townWorkerBeginReturnTrip(
  townId: TownId,
  town: TownContent,
  workerId: WorkerId,
  carriedItemId: ItemId | undefined,
  carriedQuantity: number,
): void {
  const canUseTeleports =
    getEntry<WorkerContent>(workerId)?.canUseTeleports ?? true;

  updateGamestate((state) => {
    const target = state.world.towns[townId]?.workers[workerId];
    if (!target) return state;

    const path = travelPathFrom(
      target.location,
      town.name,
      canUseTeleports,
      false,
      false,
      'None',
    );

    target.status = path
      ? {
          kind: 'TravelingBack',
          path,
          ticksIntoStep: 0,
          carriedItemId,
          carriedQuantity,
        }
      : { kind: 'AtTown' };

    return state;
  });
}
