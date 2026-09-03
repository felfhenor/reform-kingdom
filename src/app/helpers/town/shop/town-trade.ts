import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import {
  applyMaterialDelta,
  getGoldQuantity,
  goldCoinId,
  hasGold,
  spendGold,
} from '@helpers/item/materials';
import { updateGamestate } from '@helpers/state-game';
import { townStockPrice } from '@helpers/town/shop/town-price';
import { townStock, townStockDisplay } from '@helpers/town/shop/town-stock';
import type { GameState, TownContent, TownId, TownStockEntry } from '@interfaces';

// Item stock stacks (capped at owned quantity); equipment is always a single rolled instance.
export function townStockMaxQuantity(
  entry: TownStockEntry,
  price: number,
  goldQuantity: number,
): number {
  const affordable = Math.floor(goldQuantity / price);

  if ('itemId' in entry) return Math.min(entry.quantity, affordable);
  return affordable >= 1 ? 1 : 0;
}

function grantStockEntry(
  state: GameState,
  entry: TownStockEntry,
  quantity: number,
): void {
  if ('itemId' in entry) {
    applyMaterialDelta(state, entry.itemId, quantity);
    return;
  }

  state.armory = [...state.armory, entry.equipmentItem];
  const existing = state.discoveredEquipment[entry.equipmentItem.equipmentId];
  state.discoveredEquipment[entry.equipmentItem.equipmentId] = {
    foundAt: existing?.foundAt ?? Date.now(),
  };
}

// Confirms the live entry at stockIndex is still the one the fast path priced - removing an
// entry shifts later indices down, unlike a caravan's fixed trade slots.
function stockEntriesMatch(a: TownStockEntry, b: TownStockEntry): boolean {
  if ('itemId' in a && 'itemId' in b) return a.itemId === b.itemId;
  if ('equipmentItem' in a && 'equipmentItem' in b) {
    return a.equipmentItem.id === b.equipmentItem.id;
  }
  return false;
}

// Item stock decrements/drops once empty; equipment stock is always removed outright (qty 1).
function removeStockEntry(
  stock: TownStockEntry[],
  index: number,
  quantity: number,
): TownStockEntry[] {
  const entry = stock[index];
  if (!('itemId' in entry)) {
    return stock.filter((_, i) => i !== index);
  }

  const remaining = entry.quantity - quantity;
  if (remaining <= 0) return stock.filter((_, i) => i !== index);

  return stock.map((e, i) => (i === index ? { ...e, quantity: remaining } : e));
}

// Fast path only - re-validated against live state inside the callback, same
// reasoning as caravanExecuteTrade (updateGamestate commits asynchronously).
export async function townExecuteTrade(
  townId: TownId,
  stockIndex: number,
  quantity = 1,
): Promise<boolean> {
  if (quantity <= 0) return false;

  const town = getEntry<TownContent>(townId);
  if (!town) return false;

  const entry = townStock(townId)[stockIndex];
  if (!entry) return false;

  const price = townStockPrice(town, entry);
  if (price === undefined) return false;

  const maxQuantity = townStockMaxQuantity(entry, price, getGoldQuantity());
  if (quantity > maxQuantity) return false;

  const totalPrice = price * quantity;
  if (!hasGold(totalPrice)) return false;

  let executed = false;

  await updateGamestate((state) => {
    const target = state.world.towns[townId];
    const liveEntry = target?.stock[stockIndex];
    if (!target || !liveEntry) return state;
    if (!stockEntriesMatch(liveEntry, entry)) return state;

    const liveGold = state.materials[goldCoinId()]?.quantity ?? 0;
    const liveMax = townStockMaxQuantity(liveEntry, price, liveGold);
    if (quantity > liveMax) return state;

    grantStockEntry(state, liveEntry, quantity);
    spendGold(state, totalPrice);
    target.stock = removeStockEntry(target.stock, stockIndex, quantity);
    executed = true;

    return state;
  });

  if (executed) {
    const name = townStockDisplay(entry)?.name;
    analyticsSendDesignEvent(
      name
        ? `Town:Trade:${analyticsSafeSegment(name)}`
        : 'Town:Trade',
    );
  }

  return executed;
}
