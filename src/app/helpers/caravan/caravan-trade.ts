import { caravanState } from '@helpers/caravan/caravan';
import { getEntry } from '@helpers/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import {
  applyMaterialDelta,
  gainGold,
  getGoldQuantity,
  getMaterialQuantity,
  hasGold,
  hasTraderTokens,
  spendGold,
  traderTokenId,
} from '@helpers/item/materials';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import { rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanTokenTrade,
  CaravanTrade,
  CaravanTraderContent,
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  ItemContent,
  ItemPreviewDisplay,
  WorldNodeEntry,
} from '@interfaces';

// Shared by CaravanTrade and CaravanTokenTrade - both are itemId/equipmentId/collectibleId unions.
function resolveRewardDisplay(reward: {
  itemId?: ItemContent['id'];
  equipmentId?: EquipmentContent['id'];
  collectibleId?: CollectibleId;
}): ItemPreviewDisplay | undefined {
  if (reward.itemId) {
    const item = getEntry<ItemContent>(reward.itemId);
    return item ? itemPreviewDisplay(item, 'item') : undefined;
  }

  if (reward.equipmentId) {
    const equipment = getEntry<EquipmentContent>(reward.equipmentId);
    return equipment ? itemPreviewDisplay(equipment, 'equipment') : undefined;
  }

  if (reward.collectibleId) {
    const collectible = getEntry<CollectibleContent>(reward.collectibleId);
    return collectible
      ? itemPreviewDisplay(collectible, 'collectible')
      : undefined;
  }

  return undefined;
}

// Mirrors rewardContentInfo in world-nodes.ts, plus the tooltip fields that helper doesn't carry.
export function caravanTradeDisplay(
  trade: CaravanTrade,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay(trade);
}

export function caravanTokenTradeDisplay(
  trade: CaravanTokenTrade,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay(trade);
}

// How many of trade's target the party owns, shown so price can be weighed against stock.
export function caravanTradeOwnedQuantity(trade: CaravanTrade): number {
  if (trade.itemId) return getMaterialQuantity(trade.itemId);

  if (trade.equipmentId) {
    return getArmoryEntries().filter(
      (entry) => entry.content.id === trade.equipmentId,
    ).length;
  }

  if (trade.collectibleId) return getCollectibleQuantity(trade.collectibleId);

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

// A collectible sell is always one-time even with no explicit limit - once owned, sold out everywhere.
export function caravanIsTradeSoldOut(
  trade: CaravanTrade,
  tradeCounts: Record<number, number>,
  index: number,
): boolean {
  if (trade.collectibleId && isCollectibleDiscovered(trade.collectibleId)) {
    return true;
  }

  const remaining = caravanTradeRemaining(trade, tradeCounts, index);
  return remaining !== undefined && remaining <= 0;
}

// Lesser of remaining stock and what the party can afford; a collectible is capped at 1 (0 once owned).
export function caravanTradeMaxQuantity(
  caravan: CaravanContent,
  trade: CaravanTrade,
  tradeCounts: Record<number, number>,
  index: number,
): number {
  if (trade.collectibleId) {
    return isCollectibleDiscovered(trade.collectibleId) ? 0 : 1;
  }

  const remaining = caravanTradeRemaining(trade, tradeCounts, index);

  if (trade.type === 'sell') {
    const price = caravanTradePrice(caravan, trade);
    const affordable = Math.floor(getGoldQuantity() / price);
    return remaining === undefined
      ? affordable
      : Math.min(remaining, affordable);
  }

  const owned = caravanTradeOwnedQuantity(trade);
  return remaining === undefined ? owned : Math.min(remaining, owned);
}

// Shared by both the gold-trade and token-trade collectible-grant paths.
function grantCollectible(
  state: GameState,
  collectibleId: CollectibleId,
  quantity: number,
): void {
  const existing = state.collectibles[collectibleId];
  state.collectibles[collectibleId] = {
    quantity: (existing?.quantity ?? 0) + quantity,
    foundAt: existing?.foundAt ?? Date.now(),
  };
}

// Grants whichever reward type `trade` sells, `quantity` times. `quantity`
// is always 1 for a collectible (enforced by `caravanTradeMaxQuantity`).
function grantCaravanReward(
  state: GameState,
  trade: CaravanTrade,
  quantity: number,
): void {
  if (trade.itemId) {
    applyMaterialDelta(state, trade.itemId, quantity);
    return;
  }

  if (trade.equipmentId) {
    const newItems: EquipmentItem[] = Array.from({ length: quantity }, () => ({
      id: rngUuid() as EquipmentItemId,
      equipmentId: trade.equipmentId!,
      infusedItemIds: [],
    }));
    state.armory = [...state.armory, ...newItems];

    const existing = state.discoveredEquipment[trade.equipmentId];
    state.discoveredEquipment[trade.equipmentId] = {
      foundAt: existing?.foundAt ?? Date.now(),
    };
    return;
  }

  if (trade.collectibleId) {
    grantCollectible(state, trade.collectibleId, quantity);
  }
}

// Removes payment from storage/armory - the only two sources a purchase may draw from.
function takeCaravanPayment(
  state: GameState,
  trade: CaravanTrade,
  quantity: number,
): void {
  if (trade.itemId) {
    applyMaterialDelta(state, trade.itemId, -quantity);
    return;
  }

  if (trade.equipmentId) {
    let remaining = quantity;
    state.armory = state.armory.filter((item) => {
      if (remaining > 0 && item.equipmentId === trade.equipmentId) {
        remaining -= 1;
        return false;
      }
      return true;
    });
  }
}

// Buys/sells quantity units of tradeIndex atomically; returns false without changing state if unresolvable, inactive, or unaffordable.
export function caravanExecuteTrade(
  entry: WorldNodeEntry,
  tradeIndex: number,
  quantity = 1,
): boolean {
  if (quantity <= 0) return false;

  const caravan = worldNodeCaravan(entry);
  if (!caravan) return false;

  const state = caravanState(caravan.id);
  const trader = state?.traderId
    ? getEntry<CaravanTraderContent>(state.traderId)
    : undefined;
  if (!state || !trader || !state.activeTradeIndices.includes(tradeIndex)) {
    return false;
  }

  const trade = trader.trades[tradeIndex];
  if (!trade) return false;

  const maxQuantity = caravanTradeMaxQuantity(
    caravan,
    trade,
    state.tradeCounts,
    tradeIndex,
  );
  if (quantity > maxQuantity) return false;

  const totalPrice = caravanTradePrice(caravan, trade) * quantity;
  if (trade.type === 'sell' && !hasGold(totalPrice)) return false;

  updateGamestate((s) => {
    if (trade.type === 'sell') {
      grantCaravanReward(s, trade, quantity);
      spendGold(s, totalPrice);
    } else {
      takeCaravanPayment(s, trade, quantity);
      gainGold(s, totalPrice);
    }

    const nodeState = s.world.caravans[caravan.id];
    nodeState.tradeCounts[tradeIndex] =
      (nodeState.tradeCounts[tradeIndex] ?? 0) + quantity;

    return s;
  });

  analyticsSendDesignEvent('Kingdom:Caravan:Trade');
  return true;
}

// A collectible token trade is a one-time purchase, same rule as a gold
// collectible trade; item/equipment token trades have no such gate.
function isTokenTradeAlreadyOwned(trade: CaravanTokenTrade): boolean {
  if (trade.collectibleId) return isCollectibleDiscovered(trade.collectibleId);
  return false;
}

function grantTokenTradeReward(state: GameState, trade: CaravanTokenTrade): void {
  if (trade.itemId) {
    applyMaterialDelta(state, trade.itemId, 1);
    return;
  }

  if (trade.equipmentId) {
    const newItem: EquipmentItem = {
      id: rngUuid() as EquipmentItemId,
      equipmentId: trade.equipmentId,
      infusedItemIds: [],
    };
    state.armory = [...state.armory, newItem];

    const existing = state.discoveredEquipment[trade.equipmentId];
    state.discoveredEquipment[trade.equipmentId] = {
      foundAt: existing?.foundAt ?? Date.now(),
    };
    return;
  }

  if (trade.collectibleId) {
    grantCollectible(state, trade.collectibleId, 1);
  }
}

// Buys one of a trader's always-visible token trades; returns false without
// changing state if unresolvable, already owned, or unaffordable.
export function caravanExecuteTokenTrade(
  entry: WorldNodeEntry,
  tokenTradeIndex: number,
): boolean {
  const caravan = worldNodeCaravan(entry);
  if (!caravan) return false;

  const state = caravanState(caravan.id);
  const trader = state?.traderId
    ? getEntry<CaravanTraderContent>(state.traderId)
    : undefined;
  if (!trader) return false;

  const trade = trader.tokenTrades[tokenTradeIndex];
  if (!trade) return false;

  if (isTokenTradeAlreadyOwned(trade)) return false;
  if (!hasTraderTokens(trade.tokenCost)) return false;

  updateGamestate((s) => {
    grantTokenTradeReward(s, trade);
    applyMaterialDelta(s, traderTokenId(), -trade.tokenCost);
    return s;
  });

  analyticsSendDesignEvent('Kingdom:Caravan:TokenTrade');
  return true;
}
