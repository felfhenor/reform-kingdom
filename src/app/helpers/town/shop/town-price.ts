import { getEntry } from '@helpers/content/content';
import { equipmentSellValue } from '@helpers/kingdom/armory';
import { globalEffectSumsState } from '@helpers/state-game';
import type {
  EquipmentContent,
  TownContent,
  TownStockEntry,
} from '@interfaces';

// Undefined if the entry's content no longer resolves.
export function townStockPrice(
  town: TownContent,
  entry: TownStockEntry,
): number | undefined {
  const content = getEntry<EquipmentContent>(entry.equipmentItem.equipmentId);
  if (!content) return undefined;

  return townShopPrice(
    town,
    equipmentSellValue({ item: entry.equipmentItem, content }),
  );
}

// What a town shop charges for something worth `base` gold, never below 1.
export function townShopPrice(town: TownContent, base: number): number {
  const markup = 1 + town.traders.markupPercentages.sell / 100;
  const discount = 1 + globalEffectSumsState().shopPriceMultiplierBonus;
  return Math.max(1, Math.round(base * markup * discount));
}
