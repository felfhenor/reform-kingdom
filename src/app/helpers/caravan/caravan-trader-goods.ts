import { getEntriesByType } from '@helpers/content/content';
import type { CaravanTraderContent, EquipmentId, ItemId } from '@interfaces';
import { compact } from 'es-toolkit/compat';

// Content-only, so it ignores which traders are currently rolled.
export function caravanTraderSoldGoodIds(): Set<ItemId | EquipmentId> {
  const trades = getEntriesByType<CaravanTraderContent>(
    'caravantrader',
  ).flatMap((trader) => [
    ...trader.trades.filter((trade) => trade.type === 'sell'),
    ...trader.tokenTrades,
  ]);

  return new Set(
    trades.flatMap((trade) => compact([trade.itemId, trade.equipmentId])),
  );
}
