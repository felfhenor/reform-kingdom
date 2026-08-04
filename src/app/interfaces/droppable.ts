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
