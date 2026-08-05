import type { CollectibleId } from '@interfaces/content-collectible';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';

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
// quantity range), an `EquipmentId` (gear), or a `CollectibleId` (curio),
// told apart by which id field is present. Only item rewards roll a
// quantity - equipment and collectibles are always a flat chance for one.
// Shared by monster kill drops (`MonsterContent.drops`) and node completion
// rewards (`EncounterContent.completionRewards`).
export type DroppedItemReward = DropRange &
  DropHasLevelMultiplier &
  DropHasChance &
  DropItem;
export type DroppedEquipmentReward = DropHasChance & DropEquipment;
export type DroppedCollectibleReward = DropHasChance & DropCollectible;

export type DroppedReward =
  | DroppedItemReward
  | DroppedEquipmentReward
  | DroppedCollectibleReward;

// The result of rolling a `DroppedReward` - equipment/collectible drops skip
// quantity entirely since neither is stackable.
export type ResolvedItemDrop = DropItem & { quantity: number };
export type ResolvedEquipmentDrop = DropEquipment;
export type ResolvedCollectibleDrop = DropCollectible;
export type ResolvedDrop =
  | ResolvedItemDrop
  | ResolvedEquipmentDrop
  | ResolvedCollectibleDrop;
