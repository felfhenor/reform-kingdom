import { getEntry } from '@helpers/content/content';
import { equipmentSellValue } from '@helpers/kingdom/armory';
import type { EquipmentContent, TownContent, TownStockEntry } from '@interfaces';

// Same formula as caravanTradePrice - undefined if the entry's content no longer resolves.
export function townStockPrice(
  town: TownContent,
  entry: TownStockEntry,
): number | undefined {
  const content = getEntry<EquipmentContent>(entry.equipmentItem.equipmentId);
  if (!content) return undefined;

  const base = equipmentSellValue({ item: entry.equipmentItem, content });
  const markup = town.traders.markupPercentages.sell;
  return Math.max(1, Math.round(base * (1 + markup / 100)));
}
