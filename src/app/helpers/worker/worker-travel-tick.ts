import {
  categoryMessageLog,
  ITEM_ICON_TOKEN,
  itemDropHtml,
} from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import { travelPathAdvanceTick } from '@helpers/hero/travel-progress';
import { addMaterial } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  workerAssignmentIsValid,
  workerBeginOutboundTrip,
} from '@helpers/worker/worker-travel';
import type {
  CurrentLocation,
  ItemContent,
  ItemId,
  PathAdvanceResult,
  TravelStep,
  WorkerContent,
  WorkerId,
} from '@interfaces';

function advanceWorkerTravelStatus(
  workerId: WorkerId,
  path: TravelStep[],
  ticksIntoStep: number,
  location: CurrentLocation,
): PathAdvanceResult {
  const result = travelPathAdvanceTick(path, ticksIntoStep, location);

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.location = result.location;
    if (
      !result.arrived &&
      (target.status.kind === 'TravelingTo' ||
        target.status.kind === 'TravelingBack')
    ) {
      target.status.path = result.path;
      target.status.ticksIntoStep = result.ticksIntoStep;
    }

    return state;
  });

  return result;
}

function processTravelingTo(workerId: WorkerId): void {
  const worker = gamestate().workers[workerId];
  if (!worker || worker.status.kind !== 'TravelingTo') return;

  const { nodeName, itemId, path, ticksIntoStep } = worker.status;
  const result = advanceWorkerTravelStatus(
    workerId,
    path,
    ticksIntoStep,
    worker.location,
  );
  if (!result.arrived) return;

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.status = {
      kind: 'Gathering',
      nodeName,
      itemId,
      itemsGathered: 0,
      ticksIntoGather: 0,
    };

    return state;
  });
}

function logWorkerReturn(
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

function processTravelingBack(workerId: WorkerId): void {
  const worker = gamestate().workers[workerId];
  if (!worker || worker.status.kind !== 'TravelingBack') return;

  const { carriedItemId, carriedQuantity, path, ticksIntoStep } = worker.status;
  const level = worker.level;
  const result = advanceWorkerTravelStatus(
    workerId,
    path,
    ticksIntoStep,
    worker.location,
  );
  if (!result.arrived) return;

  const pendingAssignment = worker.assignment;

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.status = { kind: 'AtDuchy' };

    return state;
  });

  if (carriedItemId && carriedQuantity > 0) {
    addMaterial(carriedItemId, carriedQuantity);
    logWorkerReturn(workerId, carriedItemId, carriedQuantity);
  }

  if (!pendingAssignment) return;

  // Never trust the stored assignment blindly on redeploy - content may have
  // changed since it was set.
  if (workerAssignmentIsValid(workerId, level, pendingAssignment)) {
    workerBeginOutboundTrip(workerId, pendingAssignment);
    return;
  }

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.assignment = null;

    return state;
  });
}

export function workerTravelProcessTick(workerId: WorkerId): void {
  const status = gamestate().workers[workerId]?.status.kind;

  if (status === 'TravelingTo') {
    processTravelingTo(workerId);
    return;
  }

  if (status === 'TravelingBack') {
    processTravelingBack(workerId);
  }
}
