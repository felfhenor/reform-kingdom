import type { CollectibleId } from '@interfaces/content-collectible';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { RecipeId } from '@interfaces/content-recipe';

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

export type DropRange = {
  min: number;
  max: number;
};

export type DropHasBonusPerLevel = {
  // Flat per-level addition folded into both ends of the range (see rangeAtLevel); omitted, not 0, if unscaled.
  bonusPerLevel?: number;
};

// A range that optionally scales per level; resolve via rangeAtLevel.
export type LeveledRange = DropRange & DropHasBonusPerLevel;

export type DropHasChance = {
  chance: number;
};

// A single drop-table entry, told apart by which id field is present. Only item rewards roll a quantity; the rest are a flat chance for one.
export type DroppedItemReward = LeveledRange & DropHasChance & DropItem;
export type DroppedEquipmentReward = DropHasChance & DropEquipment;
export type DroppedCollectibleReward = DropHasChance & DropCollectible;
export type DroppedRecipeReward = DropHasChance & DropRecipe;

export type DroppedReward =
  | DroppedItemReward
  | DroppedEquipmentReward
  | DroppedCollectibleReward
  | DroppedRecipeReward;

// Bare content identity, without DroppedReward's odds/quantity fields. Used to store/compare a reward target (e.g. a Decree clause) without pinning a roll.
export type RewardIdentity =
  | DropItem
  | DropEquipment
  | DropCollectible
  | DropRecipe;

// The result of rolling a `DroppedReward` - equipment/collectible/recipe
// drops skip quantity entirely since none of them are stackable.
export type ResolvedItemDrop = DropItem & { quantity: number };
export type ResolvedEquipmentDrop = DropEquipment;
export type ResolvedCollectibleDrop = DropCollectible;
export type ResolvedRecipeDrop = DropRecipe;
export type ResolvedDrop =
  | ResolvedItemDrop
  | ResolvedEquipmentDrop
  | ResolvedCollectibleDrop
  | ResolvedRecipeDrop;
