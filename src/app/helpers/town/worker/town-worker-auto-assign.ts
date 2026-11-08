import { getEntry } from '@helpers/content/content';
import { rngChoiceWeighted } from '@helpers/rng';
import {
  townItemPriorityMap,
  townItemPriorityWeightFromMap,
} from '@helpers/town/crafting/town-craft-priority-weight';
import { townSpecialtyPriority } from '@helpers/town/crafting/town-craft-priority-state';
import {
  townMaterialAtOrAboveThreshold,
  townMaterialThreshold,
} from '@helpers/town/town-resource-thresholds';
import {
  townWorkerAssignmentIsValid,
  townWorkerCanReach,
} from '@helpers/town/worker/town-worker-travel';
import { townWorkerTripHost } from '@helpers/town/worker/town-worker-trip';
import {
  workerCombatBestDropChance,
  workerCombatItemDrops,
  workerCombatNodeLevel,
  workerCombatPower,
} from '@helpers/worker/worker-combat';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { workerTripBeginOutbound } from '@helpers/worker/worker-trip';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  ItemId,
  TownContent,
  TownItemPriorityMap,
  TownWorkerAssignment,
  TownWorkerCandidate,
  WorkerContent,
  WorkerId,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// One candidate per (reachable GatherNode, gatherable item) pair - weighted by that
// result's authored chance, so richer nodes/results are picked more often.
function gatherCandidates(
  town: TownContent,
  workerId: WorkerId,
  level: number,
  priorityMap: TownItemPriorityMap,
): TownWorkerCandidate[] {
  const candidates: TownWorkerCandidate[] = [];

  worldNodesOfType('GatherNode').forEach((node) => {
    const gathering = worldNodeGathering(node);
    if (!gathering) return;

    gatheringResultsAtLevel(gathering, worldNodeLevel(node.nodeName)).forEach(
      (result) => {
        result.items.forEach((item) => {
          // Capped items are fully excluded, not down-weighted - a worker with nothing else worth gathering just stays idle at town.
          if (townMaterialAtOrAboveThreshold(town, item.itemId)) return;

          const assignment = { nodeName: node.nodeName, itemId: item.itemId };
          if (!townWorkerAssignmentIsValid(town, workerId, level, assignment))
            return;

          const weight =
            result.chance *
            townItemPriorityWeightFromMap(priorityMap, item.itemId);
          candidates.push({ ...assignment, weight });
        });
      },
    );
  });

  return candidates;
}

// Unlike gathering, only drops the town caps count as needed, so it never farms monster loot it has no use for.
function townNeedsCombatItem(town: TownContent, itemId: ItemId): boolean {
  return (
    townMaterialThreshold(town, itemId) !== undefined &&
    !townMaterialAtOrAboveThreshold(town, itemId)
  );
}

// Power and reach come first so an idle worker's per-tick rescan only reads drop tables it could act on.
function townWorkerCombatNodeNames(
  town: TownContent,
  workerId: WorkerId,
  level: number,
): string[] {
  const content = getEntry<WorkerContent>(workerId);
  if (!content || workerStatsForLevel(content, level).combatSpeed <= 0)
    return [];

  const power = workerCombatPower(content, level);
  return worldNodesOfType('ExploreNode')
    .map((node) => node.nodeName)
    .filter(
      (nodeName) =>
        (workerCombatNodeLevel(nodeName) ?? Infinity) <= power &&
        townWorkerCanReach(town, content, level, nodeName),
    );
}

function combatCandidates(
  town: TownContent,
  workerId: WorkerId,
  level: number,
  priorityMap: TownItemPriorityMap,
): TownWorkerCandidate[] {
  return townWorkerCombatNodeNames(town, workerId, level).flatMap((nodeName) =>
    uniq(workerCombatItemDrops(nodeName).map((drop) => drop.itemId))
      .filter((itemId) => townNeedsCombatItem(town, itemId))
      .filter((itemId) =>
        townWorkerAssignmentIsValid(town, workerId, level, {
          nodeName,
          itemId,
        }),
      )
      .map((itemId) => ({
        nodeName,
        itemId,
        // Fraction, not percent: gather weights are small relative numbers, so raw percents would make towns nearly always fight.
        weight:
          (workerCombatBestDropChance(nodeName, itemId) / 100) *
          townItemPriorityWeightFromMap(priorityMap, itemId),
      })),
  );
}

function candidateAssignments(
  town: TownContent,
  workerId: WorkerId,
  level: number,
): TownWorkerCandidate[] {
  // Built once here, not per candidate item - the priority list is small but this loop can scan hundreds of items.
  const priorityMap = townItemPriorityMap(townSpecialtyPriority(town.id));
  return [
    ...gatherCandidates(town, workerId, level, priorityMap),
    ...combatCandidates(town, workerId, level, priorityMap),
  ];
}

// A town's own internal "decree" - no UI, re-run whenever a worker returns AtTown idle.
export function townPickGatherAssignment(
  town: TownContent,
  workerId: WorkerId,
  level: number,
): TownWorkerAssignment | undefined {
  const candidates = candidateAssignments(town, workerId, level);
  const picked = rngChoiceWeighted(candidates, (candidate) => candidate.weight);
  return picked
    ? { nodeName: picked.nodeName, itemId: picked.itemId }
    : undefined;
}

export function townWorkerAutoAssign(
  town: TownContent,
  workerId: WorkerId,
  level: number,
): void {
  const assignment = townPickGatherAssignment(town, workerId, level);
  if (!assignment) return;

  workerTripBeginOutbound(townWorkerTripHost(town, workerId), assignment);
}
