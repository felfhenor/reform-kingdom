import { getEntry } from '@helpers/content/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townWorkerStatsForLevel } from '@helpers/town/worker/town-worker-progression';
import {
  townWorkerAssignmentIsValid,
  townWorkerBeginReturnTrip,
} from '@helpers/town/worker/town-worker-travel';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  GatheringContent,
  ItemId,
  TownContent,
  TownId,
  WorkerContent,
  WorkerId,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

function gatheringContentForNode(
  nodeName: string,
): GatheringContent | undefined {
  const node = worldNodeByName(nodeName);
  return node ? worldNodeGathering(node) : undefined;
}

// Mirrors workerGatherRate, scaled by the town's own gatherRateMultiplier.
export function townWorkerGatherRate(
  worker: WorkerContent,
  level: number,
  gathering: GatheringContent,
  itemId: ItemId,
  nodeLevel: number,
  gatherRateMultiplier: number,
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

  const gatherSpeed = townWorkerStatsForLevel(worker, level).gatherSpeed;
  return gatherSpeed * (itemWeight / totalWeight) * gatherRateMultiplier;
}

// Defensive re-check (gamedata can change mid-session in dev) - parks AtTown on failure.
function abandonInvalidGather(townId: TownId, workerId: WorkerId): void {
  updateGamestate((state) => {
    const target = state.world.towns[townId]?.workers[workerId];
    if (!target) return state;

    target.status = { kind: 'AtTown' };
    target.assignment = null;
    return state;
  });
}

function completeGatherUnit(
  town: TownContent,
  workerId: WorkerId,
  nodeName: string,
  itemId: ItemId,
  itemsGathered: number,
  capacity: number,
): void {
  if (itemsGathered >= capacity) {
    townWorkerBeginReturnTrip(town.id, town, workerId, itemId, itemsGathered);
    return;
  }

  updateGamestate((state) => {
    const target = state.world.towns[town.id]?.workers[workerId];
    if (!target || target.status.kind !== 'Gathering') return state;

    target.status.itemsGathered = itemsGathered;
    target.status.ticksIntoGather = 0;
    return state;
  });
}

export function townWorkerGatheringProcessTick(
  town: TownContent,
  workerId: WorkerId,
): void {
  const worker = gamestate().world.towns[town.id]?.workers[workerId];
  const status = worker?.status;
  if (!worker || !status || status.kind !== 'Gathering') return;

  if (
    !townWorkerAssignmentIsValid(town, workerId, worker.level, {
      nodeName: status.nodeName,
      itemId: status.itemId,
    })
  ) {
    abandonInvalidGather(town.id, workerId);
    return;
  }

  const content = getEntry<WorkerContent>(workerId);
  const gathering = gatheringContentForNode(status.nodeName);
  if (!content || !gathering) return;

  const rate = townWorkerGatherRate(
    content,
    worker.level,
    gathering,
    status.itemId,
    worldNodeLevel(status.nodeName),
    town.gathering.gatherRateMultiplier,
  );
  if (rate <= 0) return;

  const ticksPerUnit = gathering.gatherTime / rate;
  const ticksIntoGather = status.ticksIntoGather + 1;

  if (ticksIntoGather < ticksPerUnit) {
    updateGamestate((state) => {
      const target = state.world.towns[town.id]?.workers[workerId];
      if (!target || target.status.kind !== 'Gathering') return state;

      target.status.ticksIntoGather = ticksIntoGather;
      return state;
    });
    return;
  }

  const capacity = townWorkerStatsForLevel(content, worker.level).capacity;
  completeGatherUnit(
    town,
    workerId,
    status.nodeName,
    status.itemId,
    status.itemsGathered + 1,
    capacity,
  );
}
