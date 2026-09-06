import { rngChoiceWeighted } from '@helpers/rng';
import {
  townItemPriorityMap,
  townItemPriorityWeightFromMap,
} from '@helpers/town/crafting/town-craft-priority-weight';
import { townSpecialtyPriority } from '@helpers/town/crafting/town-craft-priority-state';
import { townMaterialAtOrAboveThreshold } from '@helpers/town/town-resource-thresholds';
import {
  townWorkerAssignmentIsValid,
  townWorkerBeginOutboundTrip,
} from '@helpers/town/worker/town-worker-travel';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  TownContent,
  TownWorkerAssignment,
  WorkerId,
} from '@interfaces';

// One candidate per (reachable GatherNode, gatherable item) pair - weighted by that
// result's authored chance, so richer nodes/results are picked more often.
function candidateAssignments(
  town: TownContent,
  workerId: WorkerId,
  level: number,
): (TownWorkerAssignment & { weight: number })[] {
  // Built once here, not per candidate item - the priority list is small but this loop can scan hundreds of items.
  const priorityMap = townItemPriorityMap(townSpecialtyPriority(town.id));
  const candidates: (TownWorkerAssignment & { weight: number })[] = [];

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
            result.chance * townItemPriorityWeightFromMap(priorityMap, item.itemId);
          candidates.push({ ...assignment, weight });
        });
      },
    );
  });

  return candidates;
}

// A town's own internal "decree" - no UI, re-run whenever a worker returns AtTown idle.
export function townPickGatherAssignment(
  town: TownContent,
  workerId: WorkerId,
  level: number,
): TownWorkerAssignment | undefined {
  const candidates = candidateAssignments(town, workerId, level);
  const picked = rngChoiceWeighted(candidates, (candidate) => candidate.weight);
  return picked ? { nodeName: picked.nodeName, itemId: picked.itemId } : undefined;
}

export function townWorkerAutoAssign(
  town: TownContent,
  workerId: WorkerId,
  level: number,
): void {
  const assignment = townPickGatherAssignment(town, workerId, level);
  if (!assignment) return;

  townWorkerBeginOutboundTrip(town.id, town, workerId, assignment);
}
