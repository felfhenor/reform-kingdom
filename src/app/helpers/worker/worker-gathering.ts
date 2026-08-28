import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  workerGainXp,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import {
  workerAssignmentIsValid,
  workerBeginReturnTrip,
} from '@helpers/worker/worker-travel';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  GatheringContent,
  ItemId,
  WorkerContent,
  WorkerId,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

function gatheringContentForNode(
  nodeName: string,
): GatheringContent | undefined {
  const node = worldNodeByName(nodeName);
  if (!node) return undefined;

  return worldNodeGathering(node);
}

// Rate scales with this item's share of the node's weighted gatherResults table,
// restricted to results available at the node's current development level.
export function workerGatherRate(
  worker: WorkerContent,
  level: number,
  gathering: GatheringContent,
  itemId: ItemId,
  nodeLevel: number,
): number {
  const resultsAtLevel = gatheringResultsAtLevel(gathering, nodeLevel);

  const itemWeight = sumBy(
    resultsAtLevel.filter((result) =>
      result.items.some((item) => item.itemId === itemId),
    ),
    (result) => result.chance,
  );
  const totalWeight = sumBy(resultsAtLevel, (result) => result.chance);

  if (itemWeight <= 0 || totalWeight <= 0) return 0;

  const gatherSpeed = workerStatsForLevel(worker, level).gatherSpeed;
  return gatherSpeed * (itemWeight / totalWeight);
}

export function workerGatherXpGateSatisfied(
  gathering: GatheringContent,
  level: number,
): boolean {
  const { min, max } = gathering.workerLevelRange;
  return level >= min && level <= max;
}

// Defensive re-check (gamedata can change mid-session in dev) - parks AtDuchy on failure.
function abandonInvalidGather(workerId: WorkerId): void {
  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.status = { kind: 'AtDuchy' };
    target.assignment = null;
    return state;
  });
}

function completeGatherUnit(
  workerId: WorkerId,
  itemId: ItemId,
  itemsGathered: number,
  capacity: number,
): void {
  if (itemsGathered >= capacity) {
    workerBeginReturnTrip(workerId, itemId, itemsGathered);
    return;
  }

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target || target.status.kind !== 'Gathering') return state;

    target.status.itemsGathered = itemsGathered;
    target.status.ticksIntoGather = 0;
    return state;
  });
}

export function workerGatheringProcessTick(workerId: WorkerId): void {
  const worker = gamestate().workers[workerId];
  const status = worker?.status;
  if (!worker || !status || status.kind !== 'Gathering') return;

  if (
    !workerAssignmentIsValid(workerId, worker.level, {
      nodeName: status.nodeName,
      itemId: status.itemId,
    })
  ) {
    abandonInvalidGather(workerId);
    return;
  }

  const content = getEntry<WorkerContent>(workerId);
  const gathering = gatheringContentForNode(status.nodeName);
  if (!content || !gathering) return;

  const rate = workerGatherRate(
    content,
    worker.level,
    gathering,
    status.itemId,
    worldNodeLevel(status.nodeName),
  );
  if (rate <= 0) return;

  const ticksPerUnit = gathering.gatherTime / rate;
  const ticksIntoGather = status.ticksIntoGather + 1;

  if (ticksIntoGather < ticksPerUnit) {
    updateGamestate((state) => {
      const target = state.workers[workerId];
      if (!target || target.status.kind !== 'Gathering') return state;

      target.status.ticksIntoGather = ticksIntoGather;
      return state;
    });
    return;
  }

  if (workerGatherXpGateSatisfied(gathering, worker.level)) {
    workerGainXp(workerId, 1);
  }

  const capacity = workerStatsForLevel(content, worker.level).capacity;
  completeGatherUnit(
    workerId,
    status.itemId,
    status.itemsGathered + 1,
    capacity,
  );
}
