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
  goldCoinId,
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

// Fast path only - caravanTradeMaxQuantity is re-run against live state
// inside the callback, since updateGamestate commits asynchronously.
export async function caravanExecuteTrade(
  entry: WorldNodeEntry,
  tradeIndex: number,
  quantity = 1,
): Promise<boolean> {
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

  let executed = false;

  await updateGamestate((s) => {
    const nodeState = s.world.caravans[caravan.id];
    if (!nodeState || !nodeState.activeTradeIndices.includes(tradeIndex)) {
      return s;
    }

    const liveMax = caravanTradeMaxQuantity(
      caravan,
      trade,
      nodeState.tradeCounts,
      tradeIndex,
      s,
    );
    if (quantity > liveMax) return s;

    if (trade.type === 'sell') {
      grantCaravanReward(s, trade, quantity);
      spendGold(s, totalPrice);
    } else {
      takeCaravanPayment(s, trade, quantity);
      gainGold(s, totalPrice);
    }

    nodeState.tradeCounts[tradeIndex] =
      (nodeState.tradeCounts[tradeIndex] ?? 0) + quantity;
    executed = true;

    return s;
  });

  if (executed) analyticsSendDesignEvent('Kingdom:Caravan:Trade');
  return executed;
}

// A collectible token trade is a one-time purchase, same rule as a gold
// collectible trade; item/equipment token trades have no such gate.
function isTokenTradeAlreadyOwned(
  trade: CaravanTokenTrade,
  state?: GameState,
): boolean {
  if (trade.collectibleId) {
    return state
      ? !!state.collectibles[trade.collectibleId]?.foundAt
      : isCollectibleDiscovered(trade.collectibleId);
  }
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

// Same commit-time re-validation reasoning as caravanExecuteTrade above.
export async function caravanExecuteTokenTrade(
  entry: WorldNodeEntry,
  tokenTradeIndex: number,
): Promise<boolean> {
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

  let executed = false;

  await updateGamestate((s) => {
    if (isTokenTradeAlreadyOwned(trade, s)) return s;

    const tokenQuantity = s.materials[traderTokenId()]?.quantity ?? 0;
    if (tokenQuantity < trade.tokenCost) return s;

    grantTokenTradeReward(s, trade);
    applyMaterialDelta(s, traderTokenId(), -trade.tokenCost);
    executed = true;

    return s;
  });

  if (executed) analyticsSendDesignEvent('Kingdom:Caravan:TokenTrade');
  return executed;
}
