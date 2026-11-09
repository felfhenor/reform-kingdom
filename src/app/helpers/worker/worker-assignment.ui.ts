import { WORKER_MAX_LEVEL } from '@helpers/config';
import { gatherDifficultyTier } from '@helpers/engine/difficulty-tier';
import { rangeLabel } from '@helpers/engine/leveled-range';
import { isWorldNodeVisited } from '@helpers/world-node/world-node-visit';
import {
  getMaterialQuantity,
  isMaterialDiscovered,
} from '@helpers/item/materials';
import {
  canWorkerReachNode,
  workerStaminaCostToNode,
} from '@helpers/worker/worker-assignment';
import {
  isWorkerCombatNodeUnlocked,
  workerCombatGrantsXp,
  workerCombatItemDrops,
  workerCombatNodeLevel,
  workerCombatPower,
} from '@helpers/worker/worker-combat';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import {
  worldNodeByName,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  ItemId,
  WorkerAssignment,
  WorkerAssignmentItemOption,
  WorkerAssignmentKind,
  WorkerAssignmentMode,
  WorkerAssignmentNodeOption,
  WorkerContent,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy, uniq } from 'es-toolkit/compat';

export function workerAssignmentKind(
  assignment: WorkerAssignment,
): WorkerAssignmentKind | undefined {
  if ('recipeId' in assignment) return 'Craft';

  const type = worldNodeByName(assignment.nodeName)?.nodeData.type;
  if (type === 'GatherNode') return 'Gather';
  if (type === 'ExploreNode') return 'Combat';
  return undefined;
}

function gatherNodeOption(
  node: WorldNodeEntry,
  worker: WorkerContent,
  level: number,
): WorkerAssignmentNodeOption {
  const gathering = worldNodeGathering(node);
  const stamina = workerStatsForLevel(worker, level).stamina;
  const range = gathering?.workerLevelRange;

  return {
    nodeName: node.nodeName,
    entry: node,
    staminaCost: workerStaminaCostToNode(node.nodeName, worker.canUseTeleports),
    levelRangeLabel: range ? rangeLabel(range) : '?',
    difficulty: range ? gatherDifficultyTier(range, level) : undefined,
    noXp: level > (range?.max ?? WORKER_MAX_LEVEL),
    disabled:
      !canWorkerReachNode(node.nodeName, stamina, worker.canUseTeleports) ||
      (range?.min ?? 0) > level,
  };
}

function combatNodeOption(
  node: WorldNodeEntry,
  worker: WorkerContent,
  level: number,
): WorkerAssignmentNodeOption {
  const stats = workerStatsForLevel(worker, level);
  const nodeLevel = workerCombatNodeLevel(node.nodeName);
  const tooWeak =
    nodeLevel === undefined || workerCombatPower(worker, level) < nodeLevel;
  const noXp = !workerCombatGrantsXp(worker, level, node.nodeName);

  return {
    nodeName: node.nodeName,
    entry: node,
    staminaCost: workerStaminaCostToNode(node.nodeName, worker.canUseTeleports),
    requiredPower: nodeLevel,
    difficulty: tooWeak ? 'TooHigh' : noXp ? 'Trivial' : 'Easy',
    noXp,
    disabled:
      tooWeak ||
      stats.combatSpeed <= 0 ||
      !canWorkerReachNode(node.nodeName, stats.stamina, worker.canUseTeleports),
  };
}

// Every node the mode could ever target, disabled (not hidden) when out of reach for this worker.
export function workerAssignmentNodeOptions(
  mode: WorkerAssignmentMode,
  worker: WorkerContent,
  level: number,
): WorkerAssignmentNodeOption[] {
  const options =
    mode === 'Gather'
      ? worldNodesOfType('GatherNode')
          .filter((node) => isWorldNodeVisited(node.nodeName))
          .map((node) => gatherNodeOption(node, worker, level))
      : worldNodesOfType('ExploreNode')
          .filter((node) => isWorkerCombatNodeUnlocked(node.nodeName))
          .map((node) => combatNodeOption(node, worker, level));

  return sortBy(options, (option) => option.nodeName);
}

function workerAssignmentItemIds(
  mode: WorkerAssignmentMode,
  nodeName: string,
): ItemId[] {
  if (mode === 'Combat') {
    return uniq(
      workerCombatItemDrops(nodeName).map((drop) => drop.itemId),
    ).filter((itemId) => isMaterialDiscovered(itemId));
  }

  const node = worldNodeByName(nodeName);
  return node ? worldNodeGatherMaterialIds(node) : [];
}

export function workerAssignmentItemOptions(
  mode: WorkerAssignmentMode,
  nodeName: string,
): WorkerAssignmentItemOption[] {
  return workerAssignmentItemIds(mode, nodeName)
    .map((itemId) => {
      const info = rewardContentInfo({ itemId });
      return info
        ? { id: itemId, owned: getMaterialQuantity(itemId), ...info }
        : undefined;
    })
    .filter((option): option is WorkerAssignmentItemOption => !!option);
}
