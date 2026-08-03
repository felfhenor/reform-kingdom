import type { GameState, ItemContent, ItemId } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { setAllContentById } from '@helpers/content';
import { gamestate } from '@helpers/state-game';
import { filterStorageMaterials, getStorageMaterials } from '@helpers/storage';

describe('Storage Helper Functions', () => {
  const goldCoin: ItemContent = {
    id: 'gold-coin' as ItemId,
    name: 'Gold Coin',
    __type: 'item',
    description: 'The most important material of all!',
    sprite: '0000',
    rarity: 'Common',
  };

  const tatteredHide: ItemContent = {
    id: 'tattered-hide' as ItemId,
    name: 'Tattered Hide',
    __type: 'item',
    description: 'A weak kind of hide used for basic gear crafting.',
    sprite: '0004',
    rarity: 'Common',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setAllContentById(new Map());
  });

  describe('getStorageMaterials', () => {
    it('returns owned materials sorted by most recently found first', () => {
      setAllContentById(
        new Map([
          [tatteredHide.id, tatteredHide],
          [goldCoin.id, goldCoin],
        ]),
      );
      vi.mocked(gamestate).mockReturnValue({
        materials: {
          [tatteredHide.id]: { quantity: 2, foundAt: 1000 },
          [goldCoin.id]: { quantity: 5, foundAt: 2000 },
        },
      } as unknown as GameState);

      expect(getStorageMaterials()).toEqual([
        { item: goldCoin, quantity: 5, foundAt: 2000 },
        { item: tatteredHide, quantity: 2, foundAt: 1000 },
      ]);
    });

    it('excludes materials with zero quantity', () => {
      setAllContentById(new Map([[goldCoin.id, goldCoin]]));
      vi.mocked(gamestate).mockReturnValue({
        materials: { [goldCoin.id]: { quantity: 0, foundAt: 1000 } },
      } as unknown as GameState);

      expect(getStorageMaterials()).toEqual([]);
    });

    it('excludes materials with no matching content entry', () => {
      setAllContentById(new Map());
      vi.mocked(gamestate).mockReturnValue({
        materials: { [goldCoin.id]: { quantity: 5, foundAt: 1000 } },
      } as unknown as GameState);

      expect(getStorageMaterials()).toEqual([]);
    });
  });

  describe('filterStorageMaterials', () => {
    const entries = [
      { item: goldCoin, quantity: 5, foundAt: 2000 },
      { item: tatteredHide, quantity: 2, foundAt: 1000 },
    ];

    it('returns every entry when the search text is empty', () => {
      expect(filterStorageMaterials(entries, '   ')).toEqual(entries);
    });

    it('filters by item name, case-insensitively', () => {
      expect(filterStorageMaterials(entries, 'gold')).toEqual([
        { item: goldCoin, quantity: 5, foundAt: 2000 },
      ]);
    });

    it('filters by item description', () => {
      expect(filterStorageMaterials(entries, 'gear crafting')).toEqual([
        { item: tatteredHide, quantity: 2, foundAt: 1000 },
      ]);
    });

    it('returns an empty array when nothing matches', () => {
      expect(filterStorageMaterials(entries, 'nonexistent')).toEqual([]);
    });
  });
});
