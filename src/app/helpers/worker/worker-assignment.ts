import { getEntry } from '@helpers/content/content';
import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { isWorldNodeVisited } from '@helpers/world-node/world-node-visit';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { isMaterialDiscovered } from '@helpers/item/materials';
import {
  isWorkerCombatNode,
  isWorkerCombatNodeUnlocked,
  workerCanFightFor,
} from '@helpers/worker/worker-combat';
import {
  workerCraftAssignmentIsValid,
  workerCraftUnitAvailable,
} from '@helpers/worker/worker-crafting';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { workerGatherNodeHasItem } from '@helpers/worker/worker-shared';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type {
  RecipeContent,
  WorkerAssignment,
  WorkerContent,
  WorkerGatherAssignment,
  WorkerId,
  WorkerIdleReason,
  WorkerState,
} from '@interfaces';

// One-way only - the return trip is never stamina-gated (deliberate design
// decision: stamina is a one-way "how far can this worker be sent" budget).
export function workerStaminaCostToNode(
  nodeName: string,
  allowTeleport = true,
  passThroughNodes = false,
): number | undefined {
  const kingdom = kingdomNodeGet();
  if (!kingdom) return undefined;

  const path = travelPathFrom(
    kingdom,
    nodeName,
    allowTeleport,
    false,
    passThroughNodes,
  );
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

// Any AtDuchy counts - a worker whose route failed parks there with its assignment still set.
// A fresh craft also starts without materials, so only a recipe storage can't supply counts as waiting.
export function workerIdleReason({
  status,
}: WorkerState): WorkerIdleReason | undefined {
  if (status.kind === 'AtDuchy') return 'AtDuchy';
  if (status.kind !== 'Crafting' || status.materialsHeld) return undefined;

  const recipe = getEntry<RecipeContent>(status.recipeId);
  return recipe && !workerCraftUnitAvailable(recipe)
    ? 'WaitingForMaterials'
    : undefined;
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

function workerCombatAssignmentIsValid(
  content: WorkerContent,
  level: number,
  assignment: WorkerGatherAssignment,
): boolean {
  const { nodeName, itemId } = assignment;
  const stamina = workerStatsForLevel(content, level).stamina;

  return (
    isWorkerCombatNodeUnlocked(nodeName) &&
    isMaterialDiscovered(itemId) &&
    workerCanFightFor(content, level, nodeName, itemId, true) &&
    canWorkerReachNode(nodeName, stamina, content.canUseTeleports)
  );
}

// Combat jobs share the gather shape; the node's type tells them apart.
export function workerGatherAssignmentIsValid(
  workerId: WorkerId,
  level: number,
  assignment: WorkerGatherAssignment,
): boolean {
  const content = getEntry<WorkerContent>(workerId);
  if (!content) return false;

  if (isWorkerCombatNode(assignment.nodeName)) {
    return workerCombatAssignmentIsValid(content, level, assignment);
  }

  const stamina = workerStatsForLevel(content, level).stamina;

  return (
    isWorldNodeVisited(assignment.nodeName) &&
    workerGatherNodeHasItem(assignment.nodeName, assignment.itemId) &&
    canWorkerReachNode(assignment.nodeName, stamina, content.canUseTeleports)
  );
}
