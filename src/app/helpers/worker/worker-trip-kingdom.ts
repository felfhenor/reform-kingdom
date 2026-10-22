import {
  categoryMessageLog,
  ITEM_ICON_TOKEN,
  itemDropHtml,
} from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { addMaterial } from '@helpers/item/materials';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  workerAssignmentIsValid,
  workerGatherAssignmentIsValid,
} from '@helpers/worker/worker-assignment';
import { workerStartCrafting } from '@helpers/worker/worker-crafting';
import {
  workerGainXp,
  workerLevelInRange,
} from '@helpers/worker/worker-progression';
import { workerGatherNodeContent } from '@helpers/worker/worker-shared';
import { workerTripBeginOutbound } from '@helpers/worker/worker-trip';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type {
  ItemContent,
  ItemId,
  WorkerAssignment,
  WorkerContent,
  WorkerId,
  WorkerState,
  WorkerTripCargo,
  WorkerTripHost,
} from '@interfaces';

function kingdomWorkerGainGatherXp(
  workerId: WorkerId,
  nodeName: string,
  level: number,
): void {
  const gathering = workerGatherNodeContent(nodeName);
  if (gathering && workerLevelInRange(gathering.workerLevelRange, level)) {
    workerGainXp(workerId, 1);
  }
}

function kingdomWorkerGatherVfx(nodeName: string, itemId: ItemId): void {
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

function kingdomWorkerLogReturn(
  workerId: WorkerId,
  itemId: ItemId,
  quantity: number,
): void {
  const worker = getEntry<WorkerContent>(workerId);
  const item = getEntry<ItemContent>(itemId);
  if (!worker || !item) return;

  categoryMessageLog(
    'Gather',
    'Worker Resources',
    `${worker.name} returned with ${ITEM_ICON_TOKEN}${itemDropHtml(item, quantity)}.`,
    { sprite: item.sprite, spritesheet: 'item' },
  );
}

// Never trust the stored assignment blindly on redeploy - content may have changed since it was set.
function kingdomWorkerRedeploy(
  workerId: WorkerId,
  pending: WorkerAssignment,
  level: number,
): void {
  if (!workerAssignmentIsValid(workerId, level, pending)) {
    updateGamestate((state) => {
      const target = state.workers[workerId];
      if (target) target.assignment = null;
      return state;
    });
    return;
  }

  if ('recipeId' in pending) {
    updateGamestate((state) => {
      workerStartCrafting(state, workerId, pending.recipeId);
      return state;
    });
    return;
  }

  workerTripBeginOutbound(kingdomWorkerTripHost(workerId), pending);
}

function kingdomWorkerArrivedHome(
  workerId: WorkerId,
  cargo: WorkerTripCargo,
  pending: WorkerAssignment | null,
  level: number,
): void {
  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (target) target.status = { kind: 'AtDuchy' };
    return state;
  });

  if (cargo.itemId && cargo.quantity > 0) {
    addMaterial(cargo.itemId, cargo.quantity);
    kingdomWorkerLogReturn(workerId, cargo.itemId, cargo.quantity);
  }

  if (pending) kingdomWorkerRedeploy(workerId, pending, level);
}

// Trips always start from and return to the Kingdom node.
export function kingdomWorkerTripHost(
  workerId: WorkerId,
): WorkerTripHost<WorkerState> {
  return {
    workerId,
    read: () => gamestate().workers[workerId],
    draft: (state) => state.workers[workerId],
    setStatus: (worker, status) => {
      worker.status = status === 'idle' ? { kind: 'AtDuchy' } : status;
    },
    setAssignment: (worker, assignment) => {
      worker.assignment = assignment;
    },
    assignmentIsValid: (level, assignment) =>
      workerGatherAssignmentIsValid(workerId, level, assignment),
    pathTo: (nodeName, canUseTeleports) => {
      const kingdom = kingdomNodeGet();
      return kingdom
        ? travelPathFrom(kingdom, nodeName, canUseTeleports)
        : undefined;
    },
    pathHome: (from, canUseTeleports) => {
      const kingdom = kingdomNodeGet();
      return kingdom
        ? travelPathFrom(from, kingdom.nodeName, canUseTeleports)
        : undefined;
    },
    gatherRateMultiplier: 1,
    onUnitGathered: (nodeName, _itemId, level) =>
      kingdomWorkerGainGatherXp(workerId, nodeName, level),
    onUnitBanked: kingdomWorkerGatherVfx,
    onArrivedHome: (cargo, pending, level) =>
      kingdomWorkerArrivedHome(workerId, cargo, pending, level),
  };
}
