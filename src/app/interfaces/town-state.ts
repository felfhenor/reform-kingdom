import type { ItemId } from '@interfaces/content-item';
import type { TownId } from '@interfaces/content-town';
import type { WorkerId } from '@interfaces/content-worker';
import type { TownWorkerState } from '@interfaces/town-worker-state';
import type { EquipmentItem } from '@interfaces/equipment';

// Each subsystem gates off its own key here, not a single shared tick field, so a fast one can't starve a slow one's due-check.
export type TownTickSubsystem = 'worker' | 'craft' | 'raid' | 'quest';

// Materials stack by quantity; a crafted equipment item is always its own entry (rolled
// affixes make each one distinct, mirroring how the player's own armory is a flat item list).
export type TownStockEntry =
  | { itemId: ItemId; quantity: number }
  | { equipmentItem: EquipmentItem };

// Raw materials workers have hauled back
export type TownMaterials = Partial<Record<ItemId, number>>;

export type TownNodeState = {
  // Undefined = not yet activated (crafting/workers/commissions stay inert until the player first visits).
  firstVisitedAtTick?: number;
  lastProcessedTick: Partial<Record<TownTickSubsystem, number>>;
  stock: TownStockEntry[];
  workers: Record<WorkerId, TownWorkerState>;
  // Cumulative - never decreases except an explicit raid-loss penalty (Phase 9).
  reputation: number;
  // Hidden gold trickle from worker gathering - capped at TownGatheringConfig.goldRequiredBeforeCutoff.
  hiddenGold: number;
  materials: TownMaterials;
};

export type GameStateTowns = {
  [key: TownId]: TownNodeState;
};

// Pre-computed display state for one stock row - keeps helper-call derivations out of the component.
export type TownStockRow = {
  index: number;
  entry: TownStockEntry;
  price?: number;
  maxQuantity: number;
};
