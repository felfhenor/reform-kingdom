import { caravanState } from '@helpers/caravan/caravan';
import {
  caravanTradeMaxQuantity,
  caravanTradePrice,
} from '@helpers/caravan/caravan-trade-quantity';
import { getEntry } from '@helpers/content/content';
import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import {
  applyCollectibleGrant,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import { newEquipmentItem } from '@helpers/item/equipment';
import {
  applyMaterialDelta,
  gainGold,
  goldCoinId,
  hasTraderTokens,
  spendGold,
  traderTokenId,
} from '@helpers/item/materials';
import {
  tradeArmoryHasRoom,
  tradeCommit,
  tradeEquipmentItemLogPart,
  tradeGoodsLogPart,
  tradeLog,
} from '@helpers/item/trade';
import { addArmoryItems, armoryHasRoomForState } from '@helpers/kingdom/armory';
import { taskEventCollectibleGained } from '@helpers/task/task-events';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  AdventureLogRewardPart,
  CaravanContent,
  CaravanTokenTrade,
  CaravanTrade,
  CaravanTraderContent,
  CollectibleContent,
  EquipmentContent,
  EquipmentItem,
  GameState,
  ItemContent,
  RecipeContent,
  TradeCommitOutcome,
  TradeReceipt,
  WorldNodeEntry,
} from '@interfaces';

// Resolves whichever reward type a trade offers into its content name, for analytics.
function caravanTradeName(
  trade: CaravanTrade | CaravanTokenTrade,
): string | undefined {
  if (trade.itemId) return getEntry<ItemContent>(trade.itemId)?.name;
  if (trade.equipmentId) {
    return getEntry<EquipmentContent>(trade.equipmentId)?.name;
  }
  if (trade.collectibleId) {
    return getEntry<CollectibleContent>(trade.collectibleId)?.name;
  }
  if (trade.recipeId) return getEntry<RecipeContent>(trade.recipeId)?.name;
  return undefined;
}

// Grants whichever reward type `trade` sells, `quantity` times - always 1 for a collectible, recipe, or token trade.
// `previewedEquipment` (the caravan's pre-rolled instance, if any) is granted as the first equipment unit so a
// purchase matches what the trade preview showed; any additional units are freshly rolled.
function grantCaravanReward(
  state: GameState,
  trade: CaravanTrade | CaravanTokenTrade,
  quantity: number,
  previewedEquipment?: EquipmentItem,
): void {
  if (trade.itemId) {
    applyMaterialDelta(state, trade.itemId, quantity);
    return;
  }

  if (trade.equipmentId) {
    const items: EquipmentItem[] = [
      previewedEquipment ?? newEquipmentItem(trade.equipmentId),
      ...Array.from({ length: quantity - 1 }, () =>
        newEquipmentItem(trade.equipmentId!),
      ),
    ];
    addArmoryItems(state, trade.equipmentId, items);
    return;
  }

  if (trade.collectibleId) {
    applyCollectibleGrant(state, trade.collectibleId, quantity);
    return;
  }

  if (trade.recipeId) {
    ledgerMark(state.discoveredRecipes, trade.recipeId);
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

function caravanTradeGoodsLogPart(
  trade: CaravanTrade,
  quantity: number,
  previewed?: EquipmentItem,
): AdventureLogRewardPart | undefined {
  return previewed && quantity === 1
    ? tradeEquipmentItemLogPart(previewed)
    : tradeGoodsLogPart(trade, quantity);
}

function caravanTradeBuysEquipment(trade: CaravanTrade): boolean {
  return trade.type === 'sell' && !!trade.equipmentId;
}

function caravanTradeApply(
  state: GameState,
  caravan: CaravanContent,
  trade: CaravanTrade,
  tradeIndex: number,
  quantity: number,
  receipt: TradeReceipt,
): TradeCommitOutcome {
  const nodeState = state.world.caravans[caravan.id];
  if (!nodeState || !nodeState.activeTradeIndices.includes(tradeIndex)) {
    return 'rejected';
  }

  const liveMax = caravanTradeMaxQuantity(
    caravan,
    trade,
    nodeState.tradeCounts,
    tradeIndex,
    state,
  );
  if (quantity > liveMax) return 'rejected';

  if (
    caravanTradeBuysEquipment(trade) &&
    !armoryHasRoomForState(state, quantity)
  ) {
    return 'armoryFull';
  }

  // Re-priced in the commit so affix changes since the click can't underpay.
  const totalPrice = caravanTradePrice(caravan, trade) * quantity;
  receipt.totalPrice = totalPrice;
  if (trade.type === 'sell') {
    const previewed = nodeState.rolledEquipment?.[tradeIndex];
    receipt.goods = caravanTradeGoodsLogPart(trade, quantity, previewed);
    grantCaravanReward(state, trade, quantity, previewed);
    if (trade.equipmentId) {
      nodeState.rolledEquipment ??= {};
      nodeState.rolledEquipment[tradeIndex] = newEquipmentItem(
        trade.equipmentId,
      );
    }
    spendGold(state, totalPrice);
  } else {
    receipt.goods = caravanTradeGoodsLogPart(trade, quantity);
    takeCaravanPayment(state, trade, quantity);
    gainGold(state, totalPrice);
  }

  nodeState.tradeCounts[tradeIndex] =
    (nodeState.tradeCounts[tradeIndex] ?? 0) + quantity;
  return 'executed';
}

function caravanTradeLog(
  entry: WorldNodeEntry,
  trade: CaravanTrade,
  receipt: TradeReceipt,
): void {
  tradeLog(
    entry.nodeName,
    trade.type === 'sell' ? 'bought' : 'sold',
    [receipt.goods],
    [tradeGoodsLogPart({ itemId: goldCoinId() }, receipt.totalPrice)],
  );
}

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
  if (caravanTradeBuysEquipment(trade) && !tradeArmoryHasRoom(quantity)) {
    return false;
  }

  const receipt: TradeReceipt = { totalPrice: 0 };
  const executed = await tradeCommit((s) =>
    caravanTradeApply(s, caravan, trade, tradeIndex, quantity, receipt),
  );
  if (!executed) return false;

  caravanTradeLog(entry, trade, receipt);
  const tradeName = caravanTradeName(trade);
  analyticsSendDesignEvent(
    tradeName
      ? `Kingdom:Caravan:Trade:${analyticsSafeSegment(tradeName)}`
      : 'Kingdom:Caravan:Trade',
  );
  if (trade.type === 'sell' && trade.collectibleId) {
    void taskEventCollectibleGained(trade.collectibleId);
  }
  return true;
}

// A collectible or recipe token trade is a one-time purchase, same rule as
// their gold-trade counterparts; item/equipment token trades have no such gate.
function isTokenTradeAlreadyOwned(
  trade: CaravanTokenTrade,
  state?: GameState,
): boolean {
  if (trade.collectibleId) {
    return state
      ? ledgerHas(state.collectibles, trade.collectibleId)
      : isCollectibleDiscovered(trade.collectibleId);
  }

  if (trade.recipeId) {
    return state
      ? ledgerHas(state.discoveredRecipes, trade.recipeId)
      : isRecipeDiscovered(trade.recipeId);
  }

  return false;
}

function caravanTokenTradeApply(
  state: GameState,
  trade: CaravanTokenTrade,
): TradeCommitOutcome {
  if (isTokenTradeAlreadyOwned(trade, state)) return 'rejected';

  const tokenQuantity = state.materials[traderTokenId()]?.quantity ?? 0;
  if (tokenQuantity < trade.tokenCost) return 'rejected';

  if (trade.equipmentId && !armoryHasRoomForState(state, 1)) {
    return 'armoryFull';
  }

  grantCaravanReward(state, trade, 1);
  applyMaterialDelta(state, traderTokenId(), -trade.tokenCost);
  return 'executed';
}

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
  if (trade.equipmentId && !tradeArmoryHasRoom(1)) return false;

  const executed = await tradeCommit((s) => caravanTokenTradeApply(s, trade));
  if (!executed) return false;

  tradeLog(
    entry.nodeName,
    'bought',
    [tradeGoodsLogPart(trade, 1)],
    [tradeGoodsLogPart({ itemId: traderTokenId() }, trade.tokenCost)],
  );
  const tradeName = caravanTradeName(trade);
  analyticsSendDesignEvent(
    tradeName
      ? `Kingdom:Caravan:TokenTrade:${analyticsSafeSegment(tradeName)}`
      : 'Kingdom:Caravan:TokenTrade',
  );
  if (trade.collectibleId) {
    void taskEventCollectibleGained(trade.collectibleId);
  }
  return true;
}
