import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import { ledgerHas } from '@helpers/engine/ledger';
import { partyAffixEffects } from '@helpers/hero/party';
import { affixEffectSum } from '@helpers/item/affix';
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
      ? ledgerHas(state.discoveredRecipes, trade.recipeId)
      : isRecipeDiscovered(trade.recipeId);
    return discovered ? 1 : 0;
  }

  return 0;
}

// Party-wide affix bonus for this trade direction
// CaravanBuyDiscount reduces what the player pays CaravanSellBonus increases what the player receives
function partyCaravanAffixPercent(trade: CaravanTrade): number {
  const kind =
    trade.type === 'sell' ? 'CaravanBuyDiscount' : 'CaravanSellBonus';
  const bonusPercent = affixEffectSum(partyAffixEffects(), kind);

  return trade.type === 'sell' ? -bonusPercent : bonusPercent;
}

export function caravanTradePrice(
  caravan: CaravanContent,
  trade: CaravanTrade,
): number {
  const markup =
    trade.type === 'sell'
      ? caravan.markupPercentages.sell
      : caravan.markupPercentages.buy;

  const affixPercent = partyCaravanAffixPercent(trade);

  return Math.max(
    1,
    Math.round(trade.value * (1 + markup / 100) * (1 + affixPercent / 100)),
  );
}

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

// Lesser of remaining stock and what the party can afford (buys) or owns (sells).
// Accepts `state` for commit-time re-validation.
export function caravanTradeMaxQuantity(
  caravan: CaravanContent,
  trade: CaravanTrade,
  tradeCounts: Record<number, number>,
  index: number,
  state?: GameState,
): number {
  const stock = caravanTradeStock(trade, tradeCounts, index, state);
  const held =
    trade.type === 'sell'
      ? caravanTradeAffordable(caravan, trade, state)
      : caravanTradeOwnedQuantity(trade, state);
  return stock === undefined ? held : Math.min(stock, held);
}

// A collectible or recipe is a one-time unlock regardless of its limit.
function caravanTradeStock(
  trade: CaravanTrade,
  tradeCounts: Record<number, number>,
  index: number,
  state?: GameState,
): number | undefined {
  if (trade.collectibleId) {
    const discovered = state
      ? ledgerHas(state.collectibles, trade.collectibleId)
      : isCollectibleDiscovered(trade.collectibleId);
    return discovered ? 0 : 1;
  }

  if (trade.recipeId) {
    const discovered = state
      ? ledgerHas(state.discoveredRecipes, trade.recipeId)
      : isRecipeDiscovered(trade.recipeId);
    return discovered ? 0 : 1;
  }

  return caravanTradeRemaining(trade, tradeCounts, index);
}

function caravanTradeAffordable(
  caravan: CaravanContent,
  trade: CaravanTrade,
  state?: GameState,
): number {
  const goldQuantity = state
    ? (state.materials[goldCoinId()]?.quantity ?? 0)
    : getGoldQuantity();
  return Math.floor(goldQuantity / caravanTradePrice(caravan, trade));
}
