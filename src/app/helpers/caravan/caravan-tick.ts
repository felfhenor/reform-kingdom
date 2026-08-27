import { caravanEligibleTraders } from '@helpers/caravan/caravan';
import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
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
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

const ACTIVE_TRADE_COUNT = 4;

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
// which case it's reused (its stock still rerolls, see
// `pickActiveTradeIndices`).
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

function regenerateCaravanNode(
  content: CaravanContent,
  previousTraderId: CaravanTraderId | undefined,
  nowTick: number,
): void {
  const trader = pickTrader(content, previousTraderId);

  updateGamestate((state) => {
    state.world.caravans[content.id] = {
      traderId: trader?.id,
      activeTradeIndices: trader ? pickActiveTradeIndices(trader) : [],
      tradeCounts: {},
      generatedAtTick: nowTick,
    };
    return state;
  });
}

// Regenerates every `CaravanNode`'s trader/stock once its `traderResetTime`
// has elapsed - mirrors `encounterRandomProcessTick`.
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
