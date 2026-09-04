import type { ItemId } from '@interfaces/content-item';
import type { RecipeContent, RecipeId } from '@interfaces/content-recipe';
import type { TownId } from '@interfaces/content-town';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { WorkerId } from '@interfaces/content-worker';
import type { CraftQueueEntryId } from '@interfaces/crafting';
import type { EquipmentItem } from '@interfaces/equipment';
import type { ItemPreviewDisplay } from '@interfaces/item-preview';
import type { TownWorkerState } from '@interfaces/town-worker-state';

// Each subsystem gates off its own key here, not a single shared tick field, so a fast one can't starve a slow one's due-check.
export type TownTickSubsystem = 'worker' | 'craft' | 'raid' | 'quest' | 'shop';

// Materials stack by quantity; a crafted equipment item is always its own entry (rolled
// affixes make each one distinct, mirroring how the player's own armory is a flat item list).
// addedAtTick drives TownTradersConfig.itemExpirationTimer - applyTownStockAdd resets it on every restock.
export type TownStockEntry =
  | { itemId: ItemId; quantity: number; addedAtTick: number }
  | { equipmentItem: EquipmentItem; addedAtTick: number };

// What a caller supplies to applyTownStockAdd (which stamps addedAtTick itself) - written out rather than Omit<TownStockEntry, 'addedAtTick'> since Omit doesn't distribute over a union.
export type TownStockAddition =
  { itemId: ItemId; quantity: number } | { equipmentItem: EquipmentItem };

// Raw materials workers have hauled back
export type TownMaterials = Partial<Record<ItemId, number>>;

// Level/xp only - unlike the player's TradeskillBuildingState, a town's queue is shared (TownNodeState.craftQueue), not nested per tradeskill.
export type TownTradeskillState = {
  level: number;
  xp: { current: number; maximum: number };
};

// One crafting slot in the town's shared queue - always a single unit, unlike the player's batched queue.
export type TownCraftQueueEntry = {
  id: CraftQueueEntryId;
  tradeskillId: TradeskillId;
  recipeId: RecipeId;
  ticksIntoCraft: number;
};

// Result of townPickRecipeToQueue - returned alongside the recipe's own tradeskillId so callers don't re-derive it.
export type TownRecipePick = {
  tradeskillId: TradeskillId;
  recipe: RecipeContent;
};

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
  // Nested here (not a root GameState map like the player's tradeskills) so per-town subsystems stay co-located.
  tradeskills: Record<TradeskillId, TownTradeskillState>;
  // Combined across all tradeskills (not one queue per tradeskill) - entries tick simultaneously, mirroring multiple workers crafting in tandem.
  craftQueue: TownCraftQueueEntry[];
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
  // Pre-formatted (formatDuration) time left before this entry cycles out - undefined when the town has expiration disabled (itemExpirationTimer <= 0).
  expiresIn?: string;
};

// One row per tradeskill (always 5) - the top-of-tab level/speciality display, built by townTradeskillLevelRows.
export type TownTradeskillLevelRow = {
  tradeskillId: TradeskillId;
  name: string;
  sprite: string;
  level: number;
  isSpecialty: boolean;
};

// One row per active queue entry - built by townCraftQueueRows, rendered as a fixed-size slot (mirrors the player's own craft queue slot).
export type TownCraftQueueRow = {
  id: CraftQueueEntryId;
  tradeskillName: string;
  resultDisplay?: ItemPreviewDisplay;
  // Pre-formatted (mm:ss/hh:mm:ss via formatDuration) - the UI shows actual remaining time, not a raw tick count.
  remaining: string;
};
