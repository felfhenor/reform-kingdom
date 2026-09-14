import type { CaravanId } from '@interfaces/content-caravan';
import type { CaravanTraderId } from '@interfaces/content-caravan-trader';
import type { EquipmentItem } from '@interfaces/equipment';

export type CaravanNodeState = {
  // Undefined when no eligible trader currently exists for this caravan.
  traderId?: CaravanTraderId;

  // Set on visit; mismatching `traderId` (post-reroll) hides the merchant's name in UI again.
  visitedTraderId?: CaravanTraderId;

  // Indices into the assigned trader's `trades` array that are in stock
  // this cycle - always length <= 4.
  activeTradeIndices: number[];

  // Pre-rolled instance per active equipment-sell trade index, so the preview matches what a purchase grants.
  rolledEquipment?: Partial<Record<number, EquipmentItem>>;

  // Times each active trade has been bought/sold this cycle.
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
