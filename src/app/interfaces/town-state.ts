import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { TownId } from '@interfaces/content-town';

// Each subsystem gates off its own key here, not a single shared tick field, so a fast one can't starve a slow one's due-check.
export type TownTickSubsystem = 'worker' | 'craft' | 'raid' | 'quest';

// Either itemId or equipmentId is set, never both - mirrors CaravanTrade's shape. Produced by Phase 8's crafting; read-only until Phase 7 wires up buying.
export type TownStockEntry = {
  itemId?: ItemId;
  equipmentId?: EquipmentId;
  quantity: number;
};

export type TownNodeState = {
  // Undefined = not yet activated (crafting/workers/commissions stay inert until the player first visits).
  firstVisitedAtTick?: number;
  lastProcessedTick: Partial<Record<TownTickSubsystem, number>>;
  stock: TownStockEntry[];
};

export type GameStateTowns = {
  [key: TownId]: TownNodeState;
};
