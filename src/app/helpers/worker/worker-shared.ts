import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  AnyWorkerState,
  GatheringContent,
  ItemId,
  PathAdvanceResult,
  WorkerContent,
  WorkerGatherTickOutcome,
  WorkerStatusGathering,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

export function workerGatherNodeContent(
  nodeName: string,
): GatheringContent | undefined {
  const node = worldNodeByName(nodeName);
  return node ? worldNodeGathering(node) : undefined;
}

export function workerGatherNodeHasItem(
  nodeName: string,
  itemId: ItemId,
): boolean {
  const gathering = workerGatherNodeContent(nodeName);
  if (!gathering) return false;

  return gatheringResultsAtLevel(gathering, worldNodeLevel(nodeName)).some(
    (result) => result.items.some((item) => item.itemId === itemId),
  );
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

export function workerGatherTickOutcome(
  status: WorkerStatusGathering,
  rate: number,
  gatherTime: number,
): WorkerGatherTickOutcome {
  const ticksIntoGather = status.ticksIntoGather + 1;
  if (ticksIntoGather < gatherTime / rate) {
    return { kind: 'Progress', ticksIntoGather };
  }

  return { kind: 'UnitGathered', itemsGathered: status.itemsGathered + 1 };
}

export function applyWorkerGatherProgress(
  target: AnyWorkerState,
  ticksIntoGather: number,
): void {
  if (target.status.kind !== 'Gathering') return;
  target.status.ticksIntoGather = ticksIntoGather;
}

export function applyWorkerGatherUnit(
  target: AnyWorkerState,
  itemsGathered: number,
): void {
  if (target.status.kind !== 'Gathering') return;
  target.status.itemsGathered = itemsGathered;
  target.status.ticksIntoGather = 0;
}

export function applyWorkerTravelAdvance(
  target: AnyWorkerState,
  result: PathAdvanceResult,
): void {
  target.location = result.location;
  if (result.arrived) return;

  if (
    target.status.kind === 'TravelingTo' ||
    target.status.kind === 'TravelingBack'
  ) {
    target.status.path = result.path;
    target.status.ticksIntoStep = result.ticksIntoStep;
  }
}

export function workerGatheringStatusStart(
  nodeName: string,
  itemId: ItemId,
): WorkerStatusGathering {
  return {
    kind: 'Gathering',
    nodeName,
    itemId,
    itemsGathered: 0,
    ticksIntoGather: 0,
  };
}
