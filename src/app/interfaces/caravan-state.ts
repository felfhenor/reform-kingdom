import type { CaravanId } from '@interfaces/content-caravan';
import type {
  CaravanTrade,
  CaravanTraderId,
} from '@interfaces/content-caravan-trader';

export type CaravanNodeState = {
  // Undefined when no eligible trader currently exists for this caravan -
  // gates `worldNodeCaravanIsAvailable` and travel to the node.
  traderId?: CaravanTraderId;

  // Indices into the assigned trader's `trades` array that are in stock
  // this cycle - always length <= 4, see `caravanProcessTick`.
  activeTradeIndices: number[];

  // How many times each active trade (keyed by its index in the trader's
  // `trades` array) has been bought/sold this cycle - compared against
  // `CaravanTrade.limit` to determine "sold out".
  tradeCounts: Record<number, number>;

  generatedAtTick: number;
};

export type GameStateCaravans = {
  [key: CaravanId]: CaravanNodeState;
};

export type CaravanTimerUrgency = 'safe' | 'warning' | 'danger';

// How many of a caravan's currently active trades are buyable (the trader
// sells to the party) vs sellable (the trader buys from the party) - shown
// on the map node panel as a preview before opening the full trade modal.
export type CaravanTradeCounts = {
  buyable: number;
  sellable: number;
};

// One trade slot's worth of pre-computed display state, assembled by
// `CaravanTradeModalComponent` and handed to `CaravanTradeSlotComponent` -
// keeps the numeric/boolean derivations (helper calls) out of the
// presentational slot component.
export type CaravanTradeRow = {
  index: number;
  trade: CaravanTrade;
  price: number;
  remaining?: number;
  soldOut: boolean;
  // The most units of this trade the party could transact right now (0 if
  // unaffordable/insufficiently owned) - see `caravanTradeMaxQuantity`.
  maxQuantity: number;
  ownedQuantity: number;
};
