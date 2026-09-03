import { rngChoiceWeighted } from '@helpers/rng';
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
  const candidates: (TownWorkerAssignment & { weight: number })[] = [];

  worldNodesOfType('GatherNode').forEach((node) => {
    const gathering = worldNodeGathering(node);
    if (!gathering) return;

    gatheringResultsAtLevel(gathering, worldNodeLevel(node.nodeName)).forEach(
      (result) => {
        result.items.forEach((item) => {
          const assignment = { nodeName: node.nodeName, itemId: item.itemId };
          if (!townWorkerAssignmentIsValid(town, workerId, level, assignment))
            return;

          candidates.push({ ...assignment, weight: result.chance });
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
