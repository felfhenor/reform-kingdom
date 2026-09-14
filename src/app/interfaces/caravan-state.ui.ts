import type {
  CaravanTokenTrade,
  CaravanTrade,
} from '@interfaces/content-caravan-trader';
import type { EquipmentItem } from '@interfaces/equipment';

// Pre-computed display state for one trade slot, keeping helper-call derivations out of the presentational slot component.
export type CaravanTradeRow = {
  index: number;
  trade: CaravanTrade;
  // The pre-rolled instance being offered right now, for an equipment-sell trade.
  equipmentItem?: EquipmentItem;
  price: number;
  remaining?: number;
  soldOut: boolean;
  // The most units of this trade the party could transact right now (0 if
  // unaffordable/insufficiently owned).
  maxQuantity: number;
  ownedQuantity: number;
};

// Index into the trader's `tokenTrades` array - kept alongside the trade
// itself so a caller can execute the trade after filtering the display list.
export type CaravanTokenTradeRow = {
  index: number;
  trade: CaravanTokenTrade;
};
