import { getEntry } from '@helpers/content';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { gamestate } from '@helpers/state-game';
import type {
  EquipmentContent,
  ItemContent,
  ItemPreviewDisplay,
  TownId,
  TownStockEntry,
} from '@interfaces';

export function townStock(townId: TownId): TownStockEntry[] {
  return gamestate().world.towns[townId]?.stock ?? [];
}

export function townStockDisplay(
  entry: TownStockEntry,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay(entry);
}

// Drops entries whose itemId/equipmentId no longer resolves - mirrors pruneInvalidArmoryItems.
export function pruneInvalidTownStock(
  stock: TownStockEntry[],
): TownStockEntry[] {
  return stock.filter((entry) => {
    if (entry.itemId) return !!getEntry<ItemContent>(entry.itemId);
    if (entry.equipmentId) {
      return !!getEntry<EquipmentContent>(entry.equipmentId);
    }
    return false;
  });
}
