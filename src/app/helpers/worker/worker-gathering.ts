import { getEntry } from '@helpers/content/content';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  workerGainXp,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import {
  applyWorkerGatherProgress,
  applyWorkerGatherUnit,
  workerGatherNodeContent,
  workerGatherRate,
  workerGatherTickOutcome,
} from '@helpers/worker/worker-shared';
import {
  workerAssignmentIsValid,
  workerBeginReturnTrip,
} from '@helpers/worker/worker-travel';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import type {
  GatheringContent,
  ItemContent,
  ItemId,
  WorkerContent,
  WorkerId,
} from '@interfaces';

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

function emitWorkerGatherUnitVfx(nodeName: string, itemId: ItemId): void {
  const item = getEntry<ItemContent>(itemId);
  if (!item) return;

  gatherVfxEmit({
    nodeName,
    name: item.name,
    sprite: item.sprite,
    spritesheet: 'item',
    quantity: 1,
  });
}

function completeGatherUnit(
  workerId: WorkerId,
  nodeName: string,
  itemId: ItemId,
  itemsGathered: number,
  capacity: number,
): void {
  if (itemsGathered >= capacity) {
    const startedTrip = workerBeginReturnTrip(workerId, itemId, itemsGathered);
    if (startedTrip) emitWorkerGatherUnitVfx(nodeName, itemId);
    return;
  }

  emitWorkerGatherUnitVfx(nodeName, itemId);

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (target) applyWorkerGatherUnit(target, itemsGathered);
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
  const gathering = workerGatherNodeContent(status.nodeName);
  if (!content || !gathering) return;

  const rate = workerGatherRate(
    content,
    worker.level,
    gathering,
    status.itemId,
    worldNodeLevel(status.nodeName),
  );
  if (rate <= 0) return;

  const outcome = workerGatherTickOutcome(status, rate, gathering.gatherTime);
  if (outcome.kind === 'Progress') {
    updateGamestate((state) => {
      const target = state.workers[workerId];
      if (target) applyWorkerGatherProgress(target, outcome.ticksIntoGather);
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
    status.nodeName,
    status.itemId,
    outcome.itemsGathered,
    capacity,
  );
}
