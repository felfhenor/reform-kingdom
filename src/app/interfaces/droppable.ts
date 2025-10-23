export type DropRarity =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Mystical'
  | 'Legendary';

export const RARITY_PRIORITY: Record<DropRarity, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Mystical: 4,
  Legendary: 5,
};

export interface HasRarity {
  rarity: DropRarity;
}
