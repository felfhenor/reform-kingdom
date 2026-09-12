import { caravanEligibleTraders } from '@helpers/caravan/caravan';
import { ACTIVE_TRADE_COUNT } from '@helpers/config';
import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { newEquipmentItem } from '@helpers/item/equipment';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  worldNodeCaravan,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanNodeState,
  CaravanTraderContent,
  CaravanTraderId,
  EquipmentItem,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

function isDueForRegeneration(
  content: CaravanContent,
  state: CaravanNodeState | undefined,
  nowTick: number,
): boolean {
  if (!state) return true;
  return nowTick - state.generatedAtTick >= content.traderResetTime;
}

// Picks a weighted-random sample of up to `count` items without replacement.
// Exported for unit testing - pure aside from `Math.random()`.
export function caravanWeightedSample<T extends { weight: number }>(
  items: T[],
  count: number,
): T[] {
  const pool = [...items];
  const picked: T[] = [];

  while (pool.length > 0 && picked.length < count) {
    const totalWeight = sumBy(pool, (item) => item.weight);
    if (totalWeight <= 0) break;

    let roll = Math.random() * totalWeight;
    const index = pool.findIndex((item) => (roll -= item.weight) <= 0);

    picked.push(...pool.splice(index === -1 ? pool.length - 1 : index, 1));
  }

  return picked;
}

// A different trader than last cycle, unless only one is eligible - in
// which case it's reused.
function pickTrader(
  content: CaravanContent,
  previousTraderId: CaravanTraderId | undefined,
): CaravanTraderContent | undefined {
  const eligible = caravanEligibleTraders(content);
  if (eligible.length <= 1) return eligible[0];

  const candidates = eligible.filter(
    (trader) => trader.id !== previousTraderId,
  );
  const pool = candidates.length > 0 ? candidates : eligible;
  return pool[Math.floor(Math.random() * pool.length)];
}

// A unique collectible or recipe sell is retired from the rotation once owned.
function pickActiveTradeIndices(trader: CaravanTraderContent): number[] {
  const eligible = trader.trades
    .map((trade, index) => ({ index, weight: trade.weight, trade }))
    .filter(
      ({ trade }) =>
        (!trade.collectibleId ||
          !isCollectibleDiscovered(trade.collectibleId)) &&
        (!trade.recipeId || !isRecipeDiscovered(trade.recipeId)),
    );

  return caravanWeightedSample(eligible, ACTIVE_TRADE_COUNT).map(
    (entry) => entry.index,
  );
}

// Pre-rolls a specific equipment instance (affixes included) for every active
// equipment-sell trade, so the trade preview matches what a purchase grants.
function rollEquipmentForActiveTrades(
  trader: CaravanTraderContent,
  activeTradeIndices: number[],
): Partial<Record<number, EquipmentItem>> {
  const rolled: Partial<Record<number, EquipmentItem>> = {};

  activeTradeIndices.forEach((index) => {
    const trade = trader.trades[index];
    if (trade?.type === 'sell' && trade.equipmentId) {
      rolled[index] = newEquipmentItem(trade.equipmentId);
    }
  });

  return rolled;
}

function regenerateCaravanNode(
  content: CaravanContent,
  previousTraderId: CaravanTraderId | undefined,
  nowTick: number,
): void {
  const trader = pickTrader(content, previousTraderId);
  const activeTradeIndices = trader ? pickActiveTradeIndices(trader) : [];
  const rolledEquipment = trader
    ? rollEquipmentForActiveTrades(trader, activeTradeIndices)
    : {};

  updateGamestate((state) => {
    state.world.caravans[content.id] = {
      traderId: trader?.id,
      activeTradeIndices,
      rolledEquipment,
      tradeCounts: {},
      generatedAtTick: nowTick,
    };
    return state;
  });
}

export function caravanProcessTick(): void {
  const nowTick = timerTicksElapsed();

  worldNodesOfType('CaravanNode').forEach((entry) => {
    const content = worldNodeCaravan(entry);
    if (!content) return;

    const state = gamestate().world.caravans[content.id];
    if (!isDueForRegeneration(content, state, nowTick)) return;

    regenerateCaravanNode(content, state?.traderId, nowTick);
  });
}
