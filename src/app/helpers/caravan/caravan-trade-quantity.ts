import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import {
  getGoldQuantity,
  getMaterialQuantity,
  goldCoinId,
} from '@helpers/item/materials';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import type { CaravanContent, CaravanTrade, GameState } from '@interfaces';

// How many of trade's target the party owns, shown so price can be weighed
// against stock. Accepts an explicit `state` to re-validate at commit time.
export function caravanTradeOwnedQuantity(
  trade: CaravanTrade,
  state?: GameState,
): number {
  if (trade.itemId) {
    return state
      ? (state.materials[trade.itemId]?.quantity ?? 0)
      : getMaterialQuantity(trade.itemId);
  }

  if (trade.equipmentId) {
    if (state) {
      return state.armory.filter(
        (item) => item.equipmentId === trade.equipmentId,
      ).length;
    }
    return getArmoryEntries().filter(
      (entry) => entry.content.id === trade.equipmentId,
    ).length;
  }

  if (trade.collectibleId) {
    return state
      ? (state.collectibles[trade.collectibleId]?.quantity ?? 0)
      : getCollectibleQuantity(trade.collectibleId);
  }

  if (trade.recipeId) {
    const discovered = state
      ? !!state.discoveredRecipes[trade.recipeId]?.foundAt
      : isRecipeDiscovered(trade.recipeId);
    return discovered ? 1 : 0;
  }

  return 0;
}

export function caravanTradePrice(
  caravan: CaravanContent,
  trade: CaravanTrade,
): number {
  const markup =
    trade.type === 'sell'
      ? caravan.markupPercentages.sell
      : caravan.markupPercentages.buy;

  return Math.max(1, Math.round(trade.value * (1 + markup / 100)));
}

// Undefined for an unlimited-quantity trade.
export function caravanTradeRemaining(
  trade: CaravanTrade,
  tradeCounts: Record<number, number>,
  index: number,
): number | undefined {
  if (trade.limit === undefined) return undefined;
  return Math.max(0, trade.limit - (tradeCounts[index] ?? 0));
}

// A collectible or recipe sell is always one-time even with no explicit limit - once owned, sold out everywhere.
export function caravanIsTradeSoldOut(
  trade: CaravanTrade,
  tradeCounts: Record<number, number>,
  index: number,
): boolean {
  if (trade.collectibleId && isCollectibleDiscovered(trade.collectibleId)) {
    return true;
  }

  if (trade.recipeId && isRecipeDiscovered(trade.recipeId)) {
    return true;
  }

  const remaining = caravanTradeRemaining(trade, tradeCounts, index);
  return remaining !== undefined && remaining <= 0;
}

// Lesser of remaining stock and what the party can afford; a collectible is
// capped at 1 (0 once owned). Accepts `state` for commit-time re-validation.
export function caravanTradeMaxQuantity(
  caravan: CaravanContent,
  trade: CaravanTrade,
  tradeCounts: Record<number, number>,
  index: number,
  state?: GameState,
): number {
  if (trade.collectibleId) {
    const discovered = state
      ? !!state.collectibles[trade.collectibleId]?.foundAt
      : isCollectibleDiscovered(trade.collectibleId);
    return discovered ? 0 : 1;
  }

  if (trade.recipeId) {
    const discovered = state
      ? !!state.discoveredRecipes[trade.recipeId]?.foundAt
      : isRecipeDiscovered(trade.recipeId);
    return discovered ? 0 : 1;
  }

  const remaining = caravanTradeRemaining(trade, tradeCounts, index);

  if (trade.type === 'sell') {
    const price = caravanTradePrice(caravan, trade);
    const goldQuantity = state
      ? (state.materials[goldCoinId()]?.quantity ?? 0)
      : getGoldQuantity();
    const affordable = Math.floor(goldQuantity / price);
    return remaining === undefined
      ? affordable
      : Math.min(remaining, affordable);
  }

  const owned = caravanTradeOwnedQuantity(trade, state);
  return remaining === undefined ? owned : Math.min(remaining, owned);
}
