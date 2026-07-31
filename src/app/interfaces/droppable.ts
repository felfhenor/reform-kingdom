
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

export type HasRarity = {
  rarity: DropRarity;
}

export type Droppable = HasRarity & {
  preventModification?: boolean;
  preventDrop?: boolean;
  dropLevel: number;
  isFavorite?: boolean;
};
