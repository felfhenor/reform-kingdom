import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifyError } from '@helpers/engine/notify';
import {
  getGoldQuantity,
  goldCoinId,
  hasGold,
  spendGold,
} from '@helpers/item/materials';
import {
  addArmoryItems,
  armoryHasRoom,
  armoryHasRoomForState,
} from '@helpers/kingdom/armory';
import { updateGamestate } from '@helpers/state-game';
import { updateTownNode } from '@helpers/town/town-node';
import { townStockPrice } from '@helpers/town/shop/town-price';
import { townStock, townStockDisplay } from '@helpers/town/shop/town-stock';
import { townStockAffordable } from '@helpers/town/shop/town-trade';
import type {
  EquipmentItemId,
  GameState,
  TownContent,
  TownId,
  TownStockEntry,
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

// Keyed by itemId, not index - stock can shift while a confirm dialog is open.
// Fast path only - re-validated against live state inside the callback.
export async function townExecuteTrade(
  townId: TownId,
  itemId: EquipmentItemId,
): Promise<boolean> {
  const town = getEntry<TownContent>(townId);
  if (!town) return false;

  const entry = findStockEntry(townStock(townId), itemId);
  if (!entry) {
    notifyError('That item has disappeared from the shop.');
    return false;
  }

  const price = townStockPrice(town, entry);
  if (price === undefined) return false;
  if (!townStockAffordable(price, getGoldQuantity())) return false;
  if (!hasGold(price)) return false;

  if (!armoryHasRoom(1)) {
    notifyError('Your armory is full.');
    return false;
  }

  let executed = false;
  let vanished = false;
  let armoryFull = false;

  await updateGamestate((state) => {
    const target = state.world.towns[townId];
    const liveEntry = target ? findStockEntry(target.stock, itemId) : undefined;
    if (!target || !liveEntry) {
      vanished = true;
      return state;
    }

    const liveGold = state.materials[goldCoinId()]?.quantity ?? 0;
    if (!townStockAffordable(price, liveGold)) return state;

    if (!armoryHasRoomForState(state, 1)) {
      armoryFull = true;
      return state;
    }

    grantStockEntry(state, liveEntry);
    spendGold(state, price);
    updateTownNode(state, townId, (town) => {
      town.stock = town.stock.filter(
        (stockEntry) => stockEntry.equipmentItem.id !== itemId,
      );
    });
    executed = true;

    return state;
  });

  if (vanished) {
    notifyError('That item has disappeared from the shop.');
    return false;
  }

  if (armoryFull) {
    notifyError('Your armory is full.');
    return false;
  }

  if (executed) {
    const name = townStockDisplay(entry)?.name;
    analyticsSendDesignEvent(
      name ? `Town:Trade:${analyticsSafeSegment(name)}` : 'Town:Trade',
    );
  }

  return executed;
}
