import { caravanState } from '@helpers/caravan/caravan';
import {
  caravanTradeMaxQuantity,
  caravanTradePrice,
} from '@helpers/caravan/caravan-trade-quantity';
import { getEntry } from '@helpers/content';
import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import {
  applyMaterialDelta,
  gainGold,
  hasGold,
  hasTraderTokens,
  spendGold,
  traderTokenId,
} from '@helpers/item/materials';
import { rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanTokenTrade,
  CaravanTrade,
  CaravanTraderContent,
  CollectibleId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  RecipeId,
  WorldNodeEntry,
} from '@interfaces';

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

// Mirrors recipeDiscover (recipes.ts) but mutates the in-flight `state`
// directly, since this runs inside an existing updateGamestate callback.
function discoverRecipe(state: GameState, recipeId: RecipeId): void {
  const existing = state.discoveredRecipes[recipeId];
  state.discoveredRecipes[recipeId] = {
    foundAt: existing?.foundAt ?? Date.now(),
  };
}

// Grants whichever reward type `trade` sells, `quantity` times. `quantity`
// is always 1 for a collectible or recipe (enforced by `caravanTradeMaxQuantity`).
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
    return;
  }

  if (trade.recipeId) {
    discoverRecipe(state, trade.recipeId);
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

// A collectible or recipe token trade is a one-time purchase, same rule as
// their gold-trade counterparts; item/equipment token trades have no such gate.
function isTokenTradeAlreadyOwned(
  trade: CaravanTokenTrade,
  state?: GameState,
): boolean {
  if (trade.collectibleId) {
    return state
      ? !!state.collectibles[trade.collectibleId]?.foundAt
      : isCollectibleDiscovered(trade.collectibleId);
  }

  if (trade.recipeId) {
    return state
      ? !!state.discoveredRecipes[trade.recipeId]?.foundAt
      : isRecipeDiscovered(trade.recipeId);
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
    return;
  }

  if (trade.recipeId) {
    discoverRecipe(state, trade.recipeId);
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
