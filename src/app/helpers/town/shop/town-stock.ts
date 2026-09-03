import { getEntry } from '@helpers/content/content';
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
  return 'itemId' in entry
    ? resolveRewardDisplay({ itemId: entry.itemId })
    : resolveRewardDisplay({ equipmentId: entry.equipmentItem.equipmentId });
}

// Drops entries whose itemId/equipmentId no longer resolves - mirrors pruneInvalidArmoryItems.
export function pruneInvalidTownStock(
  stock: TownStockEntry[],
): TownStockEntry[] {
  return stock.filter((entry) =>
    'itemId' in entry
      ? !!getEntry<ItemContent>(entry.itemId)
      : !!getEntry<EquipmentContent>(entry.equipmentItem.equipmentId),
  );
}
