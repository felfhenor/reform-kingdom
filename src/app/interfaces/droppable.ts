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

export type DropHasLevelMultiplier = {
  multiplierPerLevel: number;
};

export type DropHasChance = {
  chance: number;
};

// A single drop-table entry - an `ItemId` (stackable material, with a rolled
// quantity range), an `EquipmentId` (gear), a `CollectibleId` (curio), or a
// `RecipeId` (a world-found recipe), told apart by which id field is
// present. Only item rewards roll a quantity - equipment, collectibles, and
// recipes are always a flat chance for one. Shared by monster kill drops
// (`MonsterContent.drops`) and node completion rewards
// (`EncounterContent.completionRewards`).
export type DroppedItemReward = DropRange &
  DropHasLevelMultiplier &
  DropHasChance &
  DropItem;
export type DroppedEquipmentReward = DropHasChance & DropEquipment;
export type DroppedCollectibleReward = DropHasChance & DropCollectible;
export type DroppedRecipeReward = DropHasChance & DropRecipe;

export type DroppedReward =
  | DroppedItemReward
  | DroppedEquipmentReward
  | DroppedCollectibleReward
  | DroppedRecipeReward;

// The bare identity of a reward - which content it points to, with none of
// the drop-table odds/quantity-range fields `DroppedReward` carries. Any
// `DroppedReward` is structurally assignable here, so this doubles as "just
// the id part" of one. Used where a reward needs to be stored or compared
// (e.g. a Decree clause's farm target) without pinning it to a specific roll.
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
