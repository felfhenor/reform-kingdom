import { analyticsSendDesignEvent } from '@helpers/analytics';
import { getArmoryEntries } from '@helpers/armory';
import { caravanState } from '@helpers/caravan';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/collectibles';
import { getEntry } from '@helpers/content';
import {
  applyMaterialDelta,
  gainGold,
  getGoldQuantity,
  getMaterialQuantity,
  hasGold,
  spendGold,
} from '@helpers/materials';
import { rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import { worldNodeCaravan } from '@helpers/world-nodes';
import type {
  CaravanContent,
  CaravanTrade,
  CaravanTraderContent,
  CollectibleContent,
  DropRarity,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  ItemContent,
  StatBlock,
  WorldNodeEntry,
} from '@interfaces';

export type CaravanTradeDisplay = {
  name: string;
  description: string;
  sprite: string;
  spritesheet: 'item' | 'equipment' | 'collectible';
  rarity: DropRarity;
  // Infusion stats for an item, base stats for equipment - undefined for a
  // collectible, or an item with no infusion stats to show.
  stats?: StatBlock;
  // Equipment only.
  levelRequirement?: number;
};

// Resolves whichever content type `trade` references down to display info -
// mirrors `rewardContentInfo` in `world-nodes.ts`, plus the description/
// rarity/stats the trade modal's tooltip needs that helper doesn't carry.
export function caravanTradeDisplay(
  trade: CaravanTrade,
): CaravanTradeDisplay | undefined {
  if (trade.itemId) {
    const item = getEntry<ItemContent>(trade.itemId);
    if (!item) return undefined;
    return {
      name: item.name,
      description: item.description,
      sprite: item.sprite,
      spritesheet: 'item',
      rarity: item.rarity,
      stats: item.infusionStats,
    };
  }

  if (trade.equipmentId) {
    const equipment = getEntry<EquipmentContent>(trade.equipmentId);
    if (!equipment) return undefined;
    return {
      name: equipment.name,
      description: equipment.description,
      sprite: equipment.sprite,
      spritesheet: 'equipment',
      rarity: equipment.rarity,
      stats: equipment.baseStats,
      levelRequirement: equipment.levelRequirement,
    };
  }

  if (trade.collectibleId) {
    const collectible = getEntry<CollectibleContent>(trade.collectibleId);
    if (!collectible) return undefined;
    return {
      name: collectible.name,
      description: collectible.description,
      sprite: collectible.sprite,
      spritesheet: 'collectible',
      rarity: collectible.rarity,
    };
  }

  return undefined;
}

// How many of whatever `trade` targets the party currently owns - shown in
// the trade modal so a "buy" trade's price can be weighed against what's
// already in storage/armory.
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

// A collectible sell is always a one-time purchase, even when authored with
// no explicit `limit` (the WIP data's unique trader-exclusive collectibles
// never set one) - once owned, it's sold out everywhere, permanently.
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

// The most units of `trade` the party could transact right now - the lesser
// of what's left in stock (`limit`) and what the party can actually afford
// (gold for a `sell` trade, owned quantity for a `buy` trade). A collectible
// is always capped at 1 (and 0 once owned - see `caravanIsTradeSoldOut`).
// Drives both the "sold out"/disabled state and the max on the quantity
// prompt.
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
    const existing = state.collectibles[trade.collectibleId];
    state.collectibles[trade.collectibleId] = {
      quantity: (existing?.quantity ?? 0) + quantity,
      foundAt: existing?.foundAt ?? Date.now(),
    };
  }
}

// Removes `quantity` units of whatever `trade` is buying from storage/
// armory - the only two places a caravan purchase is allowed to draw from,
// per spec.
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

// Buys/sells `quantity` units of `tradeIndex` (an index into the assigned
// trader's `trades`) at `entry`'s caravan, in a single atomic commit.
// Returns false without changing state if the caravan/trader/trade can't be
// resolved, the trade isn't currently active, or `quantity` exceeds what's
// available (sold out, insufficient gold, or insufficient owned quantity).
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
