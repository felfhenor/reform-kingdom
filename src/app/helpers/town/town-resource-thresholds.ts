import { goldCoinId } from '@helpers/item/materials';
import { townMaterialQuantity } from '@helpers/town/town-materials';
import type {
  ItemId,
  TownContent,
  TownMaterialThresholdHash,
} from '@interfaces';

// Keyed by object identity - TownContent is a stable singleton per town, so this avoids re-scanning per lookup.
const hashCache = new WeakMap<TownContent, TownMaterialThresholdHash>();

export function townMaterialThresholdHash(
  town: TownContent,
): TownMaterialThresholdHash {
  const cached = hashCache.get(town);
  if (cached) return cached;

  const hash: TownMaterialThresholdHash = {};
  town.gathering.materialThresholds.forEach((threshold) => {
    hash[threshold.itemId] = threshold.maxQuantity;
  });

  hashCache.set(town, hash);
  return hash;
}

// Undefined = no authored cap for this item - never treated as "at threshold."
export function townMaterialThreshold(
  town: TownContent,
  itemId: ItemId,
): number | undefined {
  return townMaterialThresholdHash(town)[itemId];
}

export function townMaterialAtOrAboveThreshold(
  town: TownContent,
  itemId: ItemId,
): boolean {
  const threshold = townMaterialThreshold(town, itemId);
  if (threshold === undefined) return false;

  return townMaterialQuantity(town.id, itemId) >= threshold;
}

// Gold cap is just the threshold entry for the real Gold Coin item - defaults to 0 like an unauthored item cap did before.
export function townGoldThreshold(town: TownContent): number {
  return townMaterialThreshold(town, goldCoinId()) ?? 0;
}
