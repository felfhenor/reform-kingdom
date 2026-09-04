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
import { updateGamestate } from '@helpers/state-game';
import { townStockPrice } from '@helpers/town/shop/town-price';
import { townStock, townStockDisplay } from '@helpers/town/shop/town-stock';
import type {
  GameState,
  TownContent,
  TownId,
  TownStockEntry,
} from '@interfaces';

// A town's stock is always a single rolled equipment instance - there's nothing to buy in bulk.
export function townStockAffordable(
  price: number,
  goldQuantity: number,
): boolean {
  return goldQuantity >= price;
}

function grantStockEntry(state: GameState, entry: TownStockEntry): void {
  state.armory = [...state.armory, entry.equipmentItem];
  const existing = state.discoveredEquipment[entry.equipmentItem.equipmentId];
  state.discoveredEquipment[entry.equipmentItem.equipmentId] = {
    foundAt: existing?.foundAt ?? Date.now(),
  };
}

function stockEntriesMatch(a: TownStockEntry, b: TownStockEntry): boolean {
  return a.equipmentItem.id === b.equipmentItem.id;
}

// Fast path only - re-validated against live state inside the callback, same reasoning as caravanExecuteTrade.
export async function townExecuteTrade(
  townId: TownId,
  stockIndex: number,
): Promise<boolean> {
  const town = getEntry<TownContent>(townId);
  if (!town) return false;

  const entry = townStock(townId)[stockIndex];
  if (!entry) return false;

  const price = townStockPrice(town, entry);
  if (price === undefined) return false;
  if (!townStockAffordable(price, getGoldQuantity())) return false;
  if (!hasGold(price)) return false;

  let executed = false;

  await updateGamestate((state) => {
    const target = state.world.towns[townId];
    const liveEntry = target?.stock[stockIndex];
    if (!target || !liveEntry) return state;
    if (!stockEntriesMatch(liveEntry, entry)) return state;

    const liveGold = state.materials[goldCoinId()]?.quantity ?? 0;
    if (!townStockAffordable(price, liveGold)) return state;

    grantStockEntry(state, liveEntry);
    spendGold(state, price);
    target.stock = target.stock.filter((_, i) => i !== stockIndex);
    executed = true;

    return state;
  });

  if (executed) {
    const name = townStockDisplay(entry)?.name;
    analyticsSendDesignEvent(
      name ? `Town:Trade:${analyticsSafeSegment(name)}` : 'Town:Trade',
    );
  }

  return executed;
}
