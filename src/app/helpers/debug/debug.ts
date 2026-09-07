import { getEntriesByType } from '@helpers/content/content';
import { addMaterial } from '@helpers/item/materials';
import { armoryAdd } from '@helpers/kingdom/armory';
import { updateGamestate } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import { workerAssign, workerRecall } from '@helpers/worker/worker-travel';
import {
  worldNodeDiscover,
  worldNodeUndiscover,
} from '@helpers/world-node/world-node-discovery';
import type {
  EquipmentContent,
  ItemContent,
  ItemId,
  WorkerId,
} from '@interfaces';

export function debugToggle() {
  setOption('showDebug', true);
}

export function debugGiveAllItems(quantity = 1): void {
  if (quantity <= 0) return;

  getEntriesByType<ItemContent>('item')
    .filter((item) => !item.unobtainable)
    .forEach((item) => {
      addMaterial(item.id, quantity);
    });
}

export function debugGiveAllEquipment(quantity = 1): void {
  if (quantity <= 0) return;

  getEntriesByType<EquipmentContent>('equipment')
    .filter((equipment) => !equipment.unobtainable)
    .forEach((equipment) => {
      armoryAdd(equipment.id, quantity);
    });
}

export function debugDiscoverWorldNode(nodeName: string): void {
  worldNodeDiscover(nodeName);
}

export function debugUndiscoverWorldNode(nodeName: string): void {
  worldNodeUndiscover(nodeName);
}

// Reverts every hidden node back to undiscovered - a recovery tool for
// testing hidden-node content without needing to click through each one.
export function debugWipeWorldDiscoveries(): void {
  updateGamestate((state) => {
    state.worldDiscoveries = {};
    return state;
  });
}

export function debugAssignWorker(
  workerId: WorkerId,
  nodeName: string,
  itemId: ItemId,
): void {
  if (!workerAssign(workerId, nodeName, itemId)) {
    console.warn(
      `Could not assign worker ${workerId} to ${nodeName} for ${itemId} - not rescued, node not discovered, item not gathered there, or out of stamina range.`,
    );
  }
}

export function debugRecallWorker(workerId: WorkerId): void {
  workerRecall(workerId);
}
