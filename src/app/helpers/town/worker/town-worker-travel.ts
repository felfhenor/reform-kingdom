import { getEntry } from '@helpers/content/content';
import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { workerGatherNodeHasItem } from '@helpers/worker/worker-shared';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  TownContent,
  TownWorkerAssignment,
  TravelStep,
  WorkerContent,
  WorkerId,
} from '@interfaces';

// NPC workers never use the player's outposts.
export function townWorkerTravelPath(
  from: CurrentLocation,
  toNodeName: string,
  canUseTeleports: boolean,
): TravelStep[] | undefined {
  return travelPathFrom(
    from,
    toNodeName,
    canUseTeleports,
    false,
    false,
    'None',
  );
}

// Cost from the town's own node, not the Kingdom.
export function townWorkerStaminaCostToNode(
  town: TownContent,
  nodeName: string,
  allowTeleport = true,
): number | undefined {
  const townNode = worldNodeByName(town.name);
  if (!townNode) return undefined;

  const path = townWorkerTravelPath(townNode, nodeName, allowTeleport);
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
