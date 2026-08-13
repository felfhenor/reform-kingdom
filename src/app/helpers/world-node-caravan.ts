import { caravanState, caravanTimerLabel } from '@helpers/caravan';
import { getEntry } from '@helpers/content';
import { worldNodeCaravan } from '@helpers/world-nodes';
import type {
  CaravanTrade,
  CaravanTradeCounts,
  CaravanTraderContent,
  WorldNodeEntry,
} from '@interfaces';

// True once the caravan's regeneration tick has successfully assigned a
// trader - false for a caravan whose gamedata has no eligible trader at all
// (see `caravanProcessTick`), which blocks travel to it.
export function worldNodeCaravanIsAvailable(entry: WorldNodeEntry): boolean {
  const content = worldNodeCaravan(entry);
  if (!content) return false;

  return !!caravanState(content.id)?.traderId;
}

export function worldNodeCaravanTimerText(
  entry: WorldNodeEntry,
): string | undefined {
  const content = worldNodeCaravan(entry);
  if (!content) return undefined;

  return caravanTimerLabel(content, caravanState(content.id));
}

function worldNodeCaravanTrader(
  entry: WorldNodeEntry,
): CaravanTraderContent | undefined {
  const content = worldNodeCaravan(entry);
  const traderId = content ? caravanState(content.id)?.traderId : undefined;
  return traderId ? getEntry<CaravanTraderContent>(traderId) : undefined;
}

export function worldNodeCaravanTraderLevel(
  entry: WorldNodeEntry,
): number | undefined {
  return worldNodeCaravanTrader(entry)?.level;
}

// A preview of the caravan's active stock, shown on the map node panel
// before the player opens the full trade modal.
export function worldNodeCaravanTradeCounts(
  entry: WorldNodeEntry,
): CaravanTradeCounts {
  const content = worldNodeCaravan(entry);
  const trader = worldNodeCaravanTrader(entry);
  const state = content ? caravanState(content.id) : undefined;
  if (!trader || !state) return { buyable: 0, sellable: 0 };

  const activeTrades = state.activeTradeIndices
    .map((index) => trader.trades[index])
    .filter((trade): trade is CaravanTrade => !!trade);

  return {
    buyable: activeTrades.filter((trade) => trade.type === 'sell').length,
    sellable: activeTrades.filter((trade) => trade.type === 'buy').length,
  };
}
