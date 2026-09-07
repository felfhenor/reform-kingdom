import type { CommissionRequirement } from '@interfaces/commission-state';
import type { CommissionOfferId } from '@interfaces/content-commission-offer';
import type { ItemContent, ItemId } from '@interfaces/content-item';
import type { MonsterContent, MonsterId } from '@interfaces/content-monster';
import type { RecipeContent, RecipeId } from '@interfaces/content-recipe';
import type { TownId } from '@interfaces/content-town';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { WorkerId } from '@interfaces/content-worker';
import type { CraftQueueEntryId } from '@interfaces/crafting';
import type { EquipmentItem } from '@interfaces/equipment';
import type { Branded } from '@interfaces/identifiable';
import type { ItemPreviewDisplay } from '@interfaces/item-preview';
import type { TownWorkerState } from '@interfaces/town-worker-state';

// Each subsystem gates off its own key here, not a single shared tick field, so a fast one can't starve a slow one's due-check.
export type TownTickSubsystem =
  'worker' | 'craft' | 'raid' | 'quest' | 'shop' | 'specialty';

export type TownStockEntry = {
  equipmentItem: EquipmentItem;
  addedAtTick: number;
};

export type TownStockAddition = Omit<TownStockEntry, 'addedAtTick'>;

// Raw materials workers have hauled back
export type TownMaterials = Partial<Record<ItemId, number>>;

// The queue is also shared, not nested per tradeskill.
export type TownTradeskillState = {
  level: number;
};

// One crafting slot in the town's shared queue - always a single unit, unlike the player's batched queue.
export type TownCraftQueueEntry = {
  id: CraftQueueEntryId;
  tradeskillId: TradeskillId;
  recipeId: RecipeId;
  ticksIntoCraft: number;
};

// Returned alongside the recipe's own tradeskillId so callers don't re-derive it.
export type TownRecipePick = {
  tradeskillId: TradeskillId;
  recipe: RecipeContent;
};

// A specialty recipe the town has repeatedly failed to craft - failureCount escalates gathering/commission bias toward it, removed once actually crafted.
export type TownSpecialtyPriorityEntry = {
  recipeId: RecipeId;
  failureCount: number;
};

// A town's specialtyPriority flattened to per-item lookups - built once per scan instead of
// rescanning the priority list per candidate item, which matters when scanning every gatherable across every node.
export type TownItemPriorityMap = {
  weightByItem: Partial<Record<ItemId, number>>;
  reservedByItem: Partial<
    Record<
      ItemId,
      { total: number; byRecipe: Partial<Record<RecipeId, number>> }
    >
  >;
};

export type TownCommissionSlotId = Branded<string, 'TownCommissionSlotId'>;

// Unlike a caravan's single commission, a town holds several simultaneous slots that persist until turned in - a fulfilled one is removed outright, not flagged, and the next tick refills the opening.
export type TownCommissionSlotState = {
  id: TownCommissionSlotId;
  commissionOfferId: CommissionOfferId;
  requirements: CommissionRequirement[];
  generatedAtTick: number;
};

export type TownNodeState = {
  // Undefined = not yet activated (crafting/workers/commissions stay inert until the player first visits).
  firstVisitedAtTick?: number;
  lastProcessedTick: Partial<Record<TownTickSubsystem, number>>;
  stock: TownStockEntry[];
  workers: Record<WorkerId, TownWorkerState>;
  // Cumulative - never decreases except an explicit raid-loss penalty (Phase 9).
  reputation: number;
  // Hidden gold trickle from worker gathering.
  hiddenGold: number;
  materials: TownMaterials;
  // Nested here (not a root GameState map like the player's tradeskills) so per-town subsystems stay co-located.
  tradeskills: Record<TradeskillId, TownTradeskillState>;
  // Combined across all tradeskills (not one queue per tradeskill) - entries tick simultaneously, mirroring multiple workers crafting in tandem.
  craftQueue: TownCraftQueueEntry[];
  commissionSlots: TownCommissionSlotState[];
  specialtyPriority: TownSpecialtyPriorityEntry[];
  // Undefined = no raid currently pending.
  raidTelegraphedAtTick?: number;
  raidEngageWindowExpiresAtTick?: number;
  // Rolled once at telegraph time so the Raid tab preview always matches what actually spawns.
  raidTelegraphedAssaulterIds?: MonsterId[];
  // Gates the once/day/town raid cap - set on every resolution (win, loss, or missed-window).
  lastRaidResolvedAtTick?: number;
  // Raid-loss penalty - consumed as an extra multiplier.
  craftSpeedDebuffExpiresAtTick?: number;
};

export type GameStateTowns = {
  [key: TownId]: TownNodeState;
};

// All three fields are always set/cleared together.
export type TownRaidTelegraph = {
  telegraphedAtTick: number;
  engageWindowExpiresAtTick: number;
  assaulterMonsterIds: MonsterId[];
};

// One resolved+counted monster row for the Raid tab's assaulter/defender preview lists.
export type TownRaidCombatantRow = {
  monster: MonsterContent;
  quantity: number;
};

// One row per telegraphed raid for the Requested Defenses modal - sorted by soonest engageWindowExpiresAtTick.
export type RaidDefenseRowViewModel = {
  townId: TownId;
  townName: string;
  nodeName: string;
  ticksUntilResolve: number;
  remainingLabel: string;
  assaulters: TownRaidCombatantRow[];
  defenders: TownRaidCombatantRow[];
  isPartyHere: boolean;
  canTravel: boolean;
  // Set only while actively traveling toward this row's node.
  travelEtaSeconds?: number;
};

// One lost material row for the raid-loss adventure-log message - full content (not just name).
export type TownRaidLostMaterial = {
  item: ItemContent;
  quantity: number;
};

export type TownRaidLossSummary = {
  stolenItemNames: string[];
  cancelledCraftNames: string[];
  lostMaterials: TownRaidLostMaterial[];
};

// Pre-computed display state for one stock row - keeps helper-call derivations out of the component.
export type TownStockRow = {
  index: number;
  entry: TownStockEntry;
  price?: number;
  // A town's shop stock is always single rolled equipment instances - "can I afford one", not a quantity range.
  affordable: boolean;
  // Pre-formatted time left before this entry cycles out - undefined when the town has expiration disabled.
  expiresIn?: string;
};

// One row per tradeskill (always 5) - the top-of-tab level/speciality display.
export type TownTradeskillLevelRow = {
  tradeskillId: TradeskillId;
  name: string;
  sprite: string;
  level: number;
  isSpecialty: boolean;
};

// One row per active queue entry - rendered as a fixed-size slot (mirrors the player's own craft queue slot).
export type TownCraftQueueRow = {
  id: CraftQueueEntryId;
  tradeskillName: string;
  resultDisplay?: ItemPreviewDisplay;
  // Pre-formatted (mm:ss/hh:mm:ss) - the UI shows actual remaining time, not a raw tick count.
  remaining: string;
};
