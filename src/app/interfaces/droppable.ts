import type { CollectibleId } from '@interfaces/content-collectible';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { RecipeId } from '@interfaces/content-recipe';
import type { WorkerId } from '@interfaces/content-worker';

export type DropRarity =
  'Common' | 'Uncommon' | 'Rare' | 'Mystical' | 'Legendary';

export const RARITY_PRIORITY: Record<DropRarity, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Mystical: 4,
  Legendary: 5,
};

export type HasRarity = {
  rarity: DropRarity;
};

export type DropItem = {
  itemId: ItemId;
};

export type DropEquipment = {
  equipmentId: EquipmentId;
};

export type DropCollectible = {
  collectibleId: CollectibleId;
};

export type DropRecipe = {
  recipeId: RecipeId;
};

export type DropWorker = {
  workerId: WorkerId;
};

export type DropRange = {
  min: number;
  max: number;
};

export type DropLevelRange = {
  minLevel: number;
  maxLevel: number;
};

export type DropHasBonusPerLevel = {
  // Flat per-level addition folded into both ends of the range; omitted, not 0, if unscaled.
  bonusPerLevel?: number;
};

// A range that optionally scales per level.
export type LeveledRange = DropRange & DropHasBonusPerLevel;

export type DropHasChance = {
  chance: number;
};

// A single drop-table entry. `kind` is an explicit discriminant so every consumer can
// `switch (reward.kind)` and get a compile error on a missed variant.
export type DroppedItemReward = DropLevelRange &
  LeveledRange &
  DropHasChance &
  DropItem & { kind: 'Item' };
export type DroppedEquipmentReward = DropLevelRange &
  DropHasChance &
  DropEquipment & { kind: 'Equipment' };
export type DroppedCollectibleReward = DropLevelRange &
  DropHasChance &
  DropCollectible & { kind: 'Collectible' };
export type DroppedRecipeReward = DropLevelRange &
  DropHasChance &
  DropRecipe & { kind: 'Recipe' };
export type DroppedWorkerReward = DropLevelRange &
  DropHasChance &
  DropWorker & { kind: 'Worker' };

export type DroppedReward =
  | DroppedItemReward
  | DroppedEquipmentReward
  | DroppedCollectibleReward
  | DroppedRecipeReward
  | DroppedWorkerReward;

// Bare content identity, without DroppedReward's odds/quantity fields. Used to store/compare a reward target (e.g. a Decree clause) without pinning a roll.
export type RewardIdentity =
  DropItem | DropEquipment | DropCollectible | DropRecipe | DropWorker;

// The result of rolling a `DroppedReward` - equipment/collectible/recipe/worker
// drops skip quantity entirely since none of them are stackable.
export type ResolvedItemDrop = DropItem & { quantity: number; kind: 'Item' };
export type ResolvedEquipmentDrop = DropEquipment & { kind: 'Equipment' };
export type ResolvedCollectibleDrop = DropCollectible & { kind: 'Collectible' };
export type ResolvedRecipeDrop = DropRecipe & { kind: 'Recipe' };
export type ResolvedWorkerDrop = DropWorker & { kind: 'Worker' };
export type ResolvedDrop =
  | ResolvedItemDrop
  | ResolvedEquipmentDrop
  | ResolvedCollectibleDrop
  | ResolvedRecipeDrop
  | ResolvedWorkerDrop;
