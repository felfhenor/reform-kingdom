import { getEntry } from '@helpers/content/content';
import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import {
  isWorkerCombatNode,
  workerCanFightFor,
} from '@helpers/worker/worker-combat';
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

export function townWorkerCanReach(
  town: TownContent,
  content: WorkerContent,
  level: number,
  nodeName: string,
): boolean {
  const stamina = workerStatsForLevel(content, level).stamina;
  const cost = townWorkerStaminaCostToNode(
    town,
    nodeName,
    content.canUseTeleports,
  );
  return cost !== undefined && cost <= stamina;
}

// No discovery or cleared check - town workers are NPC-run, not player exploration.
export function townWorkerAssignmentIsValid(
  town: TownContent,
  workerId: WorkerId,
  level: number,
  assignment: TownWorkerAssignment,
): boolean {
  const content = getEntry<WorkerContent>(workerId);
  if (!content) return false;

  const { nodeName, itemId } = assignment;
  const canDoJob = isWorkerCombatNode(nodeName)
    ? workerCanFightFor(content, level, nodeName, itemId, false)
    : workerGatherNodeHasItem(nodeName, itemId);

  return canDoJob && townWorkerCanReach(town, content, level, nodeName);
}
