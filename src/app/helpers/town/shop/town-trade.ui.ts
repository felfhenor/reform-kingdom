import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import {
  getGoldQuantity,
  goldCoinId,
  hasGold,
  spendGold,
} from '@helpers/item/materials';
import {
  tradeArmoryHasRoom,
  tradeCommit,
  tradeEquipmentItemLogPart,
  tradeGoodsLogPart,
  tradeLog,
  tradeWarn,
} from '@helpers/item/trade';
import { addArmoryItems, armoryHasRoomForState } from '@helpers/kingdom/armory';
import { townStockPrice } from '@helpers/town/shop/town-price';
import { townStock, townStockDisplay } from '@helpers/town/shop/town-stock';
import { townStockAffordable } from '@helpers/town/shop/town-trade';
import type {
  EquipmentItemId,
  GameState,
  TownContent,
  TownId,
  TownStockEntry,
  TradeCommitOutcome,
} from '@interfaces';

function grantStockEntry(state: GameState, entry: TownStockEntry): void {
  addArmoryItems(state, entry.equipmentItem.equipmentId, [entry.equipmentItem]);
}

function findStockEntry(
  stock: TownStockEntry[],
  itemId: EquipmentItemId,
): TownStockEntry | undefined {
  return stock.find((entry) => entry.equipmentItem.id === itemId);
}

function townTradeApply(
  state: GameState,
  townId: TownId,
  itemId: EquipmentItemId,
  price: number,
): TradeCommitOutcome {
  const target = state.world.towns[townId];
  const liveEntry = target ? findStockEntry(target.stock, itemId) : undefined;
  if (!target || !liveEntry) return 'vanished';

  const liveGold = state.materials[goldCoinId()]?.quantity ?? 0;
  if (!townStockAffordable(price, liveGold)) return 'rejected';
  if (!armoryHasRoomForState(state, 1)) return 'armoryFull';

  grantStockEntry(state, liveEntry);
  spendGold(state, price);
  target.stock = target.stock.filter(
    (stockEntry) => stockEntry.equipmentItem.id !== itemId,
  );
  return 'executed';
}

// Keyed by itemId, not index - stock can shift while a confirm dialog is open.
// Fast path only - re-validated against live state inside the commit.
export async function townExecuteTrade(
  townId: TownId,
  itemId: EquipmentItemId,
): Promise<boolean> {
  const town = getEntry<TownContent>(townId);
  if (!town) return false;

  const entry = findStockEntry(townStock(townId), itemId);
  if (!entry) {
    tradeWarn('vanished');
    return false;
  }

  const price = townStockPrice(town, entry);
  if (price === undefined) return false;
  if (!townStockAffordable(price, getGoldQuantity())) return false;
  if (!hasGold(price)) return false;
  if (!tradeArmoryHasRoom(1)) return false;

  const executed = await tradeCommit((state) =>
    townTradeApply(state, townId, itemId, price),
  );
  if (!executed) return false;

  tradeLog(
    town.name,
    'bought',
    [tradeEquipmentItemLogPart(entry.equipmentItem)],
    [tradeGoodsLogPart({ itemId: goldCoinId() }, price)],
  );
  const name = townStockDisplay(entry)?.name;
  analyticsSendDesignEvent(
    name ? `Town:Trade:${analyticsSafeSegment(name)}` : 'Town:Trade',
  );
  return true;
}
