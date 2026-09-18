import { townMaterialQuantity } from '@helpers/town/town-materials';
import type { ItemId, TownContent, TownMaterialThreshold } from '@interfaces';

// A materialThresholds entry only counts as sellable once it opts in via value > 0.
export function townMaterialSaleConfig(
  town: TownContent,
  itemId: ItemId,
): TownMaterialThreshold | undefined {
  return town.materialThresholds.find(
    (threshold) => threshold.itemId === itemId && threshold.value > 0,
  );
}

// Premium price - same markup% and rounding convention as townStockPrice.
export function townMaterialSalePrice(
  town: TownContent,
  threshold: TownMaterialThreshold,
): number {
  const markup = town.traders.markupPercentages.sell;
  return Math.max(1, Math.round(threshold.value * (1 + markup / 100)));
}

// Only the coffer quantity above the sale's threshold counts as excess for sale.
export function townMaterialSaleAvailable(
  town: TownContent,
  threshold: TownMaterialThreshold,
): number {
  return Math.max(
    0,
    townMaterialQuantity(town.id, threshold.itemId) - threshold.sellAtQuantity,
  );
}

export function townMaterialSaleMaxQuantity(
  town: TownContent,
  threshold: TownMaterialThreshold,
  goldQuantity: number,
): number {
  const price = townMaterialSalePrice(town, threshold);
  const available = townMaterialSaleAvailable(town, threshold);
  return Math.min(available, Math.floor(goldQuantity / price));
}
