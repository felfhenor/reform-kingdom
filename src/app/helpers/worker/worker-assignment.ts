import { getEntry } from '@helpers/content/content';
import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { workerCraftAssignmentIsValid } from '@helpers/worker/worker-crafting';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { workerGatherNodeHasItem } from '@helpers/worker/worker-shared';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type {
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

export function workerGatherAssignmentIsValid(
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
