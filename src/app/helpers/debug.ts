import { armoryAdd } from '@helpers/armory';
import { collectiblesAdd } from '@helpers/collectibles';
import { getEntriesByType, getEntry } from '@helpers/content';
import { addMaterial } from '@helpers/materials';
import { setOption } from '@helpers/state-options';
import type {
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
} from '@interfaces';

export function debugToggle() {
  setOption('showDebug', true);
}

export function debugGiveItem(itemId: ItemId, quantity: number): void {
  if (quantity <= 0) return;
  const material = getEntry<ItemContent>(itemId);
  if (!material) {
    console.warn(`Item with ID ${itemId} not found.`);
    return;
  }

  addMaterial(material.id, quantity);
}

export function debugGiveAllItems(quantity = 1): void {
  if (quantity <= 0) return;

  getEntriesByType<ItemContent>('item').forEach((item) => {
    addMaterial(item.id, quantity);
  });
}

export function debugGiveEquipment(
  equipmentId: EquipmentId,
  quantity: number,
): void {
  if (quantity <= 0) return;

  const equipment = getEntry<EquipmentContent>(equipmentId);
  if (!equipment) {
    console.warn(`Equipment with ID ${equipmentId} not found.`);
    return;
  }

  armoryAdd(equipment.id, quantity);
}

export function debugGiveAllEquipment(quantity = 1): void {
  if (quantity <= 0) return;

  getEntriesByType<EquipmentContent>('equipment').forEach((equipment) => {
    armoryAdd(equipment.id, quantity);
  });
}

export function debugGiveCollectible(
  collectibleId: CollectibleId,
  quantity: number,
): void {
  if (quantity <= 0) return;

  const collectible = getEntry<CollectibleContent>(collectibleId);
  if (!collectible) {
    console.warn(`Collectible with ID ${collectibleId} not found.`);
    return;
  }

  collectiblesAdd(collectible.id, quantity);
}
