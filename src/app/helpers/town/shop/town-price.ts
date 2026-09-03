import { getEntry } from '@helpers/content/content';
import { equipmentSellValue } from '@helpers/kingdom/armory';
import type {
  DropRarity,
  EquipmentContent,
  ItemContent,
  TownContent,
  TownStockEntry,
} from '@interfaces';

// No existing sell-value system for raw items/materials (unlike equipment's armory formula) -
// a town-shop-specific placeholder table, easy to rebalance independently.
const ITEM_STOCK_BASE_PRICE: Record<DropRarity, number> = {
  Common: 5,
  Uncommon: 15,
  Rare: 40,
  Mystical: 100,
  Legendary: 250,
};

function townStockBasePrice(entry: TownStockEntry): number | undefined {
  if ('itemId' in entry) {
    const content = getEntry<ItemContent>(entry.itemId);
    return content ? ITEM_STOCK_BASE_PRICE[content.rarity] : undefined;
  }

  const content = getEntry<EquipmentContent>(entry.equipmentItem.equipmentId);
  return content
    ? equipmentSellValue({ item: entry.equipmentItem, content })
    : undefined;
}

// Same formula as caravanTradePrice - undefined if the entry's content no longer resolves.
export function townStockPrice(
  town: TownContent,
  entry: TownStockEntry,
): number | undefined {
  const base = townStockBasePrice(entry);
  if (base === undefined) return undefined;

  const markup = town.traders.markupPercentages.sell;
  return Math.max(1, Math.round(base * (1 + markup / 100)));
}
