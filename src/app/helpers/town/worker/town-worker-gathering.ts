import { getEntry } from '@helpers/content/content';
import { updateGamestate, worldTownsState } from '@helpers/state-game';
import {
  townWorkerAssignmentIsValid,
  townWorkerBeginReturnTrip,
} from '@helpers/town/worker/town-worker-travel';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import {
  applyWorkerGatherProgress,
  applyWorkerGatherUnit,
  workerGatherNodeContent,
  workerGatherRate,
  workerGatherTickOutcome,
} from '@helpers/worker/worker-shared';
import { gatheringEffectiveGatherTime } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import type {
  GatheringContent,
  ItemId,
  TownContent,
  TownId,
  WorkerContent,
  WorkerId,
} from '@interfaces';

// Scaled by the town's own gatherRateMultiplier.
export function townWorkerGatherRate(
  worker: WorkerContent,
  level: number,
  gathering: GatheringContent,
  itemId: ItemId,
  nodeLevel: number,
  gatherRateMultiplier: number,
): number {
  return (
    workerGatherRate(worker, level, gathering, itemId, nodeLevel) *
    gatherRateMultiplier
  );
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
    if (target) applyWorkerGatherUnit(target, itemsGathered);
    return state;
  });
}

export function townWorkerGatheringProcessTick(
  town: TownContent,
  workerId: WorkerId,
): void {
  const worker = worldTownsState()[town.id]?.workers[workerId];
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
  const gathering = workerGatherNodeContent(status.nodeName);
  if (!content || !gathering) return;

  const nodeLevel = worldNodeLevel(status.nodeName);
  const rate = townWorkerGatherRate(
    content,
    worker.level,
    gathering,
    status.itemId,
    nodeLevel,
    town.gathering.gatherRateMultiplier,
  );
  if (rate <= 0) return;

  const outcome = workerGatherTickOutcome(
    status,
    rate,
    gatheringEffectiveGatherTime(gathering, nodeLevel),
  );
  if (outcome.kind === 'Progress') {
    updateGamestate((state) => {
      const target = state.world.towns[town.id]?.workers[workerId];
      if (target) applyWorkerGatherProgress(target, outcome.ticksIntoGather);
      return state;
    });
    return;
  }

  const capacity = workerStatsForLevel(content, worker.level).capacity;
  completeGatherUnit(
    town,
    workerId,
    status.itemId,
    outcome.itemsGathered,
    capacity,
  );
}
