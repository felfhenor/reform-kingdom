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

// A single drop-table entry - either an `ItemId` (stackable material) or an
// `EquipmentId` (gear), told apart by which id field is present. Shared by
// monster kill drops (`MonsterContent.drops`) and node completion rewards
// (`EncounterContent.completionRewards`).
export type DroppedReward = DropRange &
  DropHasLevelMultiplier &
  DropHasChance &
  (DropItem | DropEquipment);

// The result of rolling a `DroppedReward` - equipment drops skip quantity
// entirely since gear isn't stackable.
export type ResolvedItemDrop = DropItem & { quantity: number };
export type ResolvedEquipmentDrop = DropEquipment;
export type ResolvedDrop = ResolvedItemDrop | ResolvedEquipmentDrop;
