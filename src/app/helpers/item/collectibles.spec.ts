import type * as AnalyticsHelper from '@helpers/engine/analytics';
import type {
  CollectibleContent,
  CollectibleId,
  GameState,
  GameStateCollectibles,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import {
  collectiblesAdd,
  getCollectibleQuantity,
  grantFoundingStoneIfMissing,
  isCollectibleDiscovered,
  pruneInvalidCollectibles,
} from '@helpers/item/collectibles';
import { gamestate, updateGamestate } from '@helpers/state-game';

const foundingStone: CollectibleContent = {
  id: 'founding-stone' as CollectibleId,
  name: 'Founding Stone',
  __type: 'collectible',
  description: 'A stone that was used to found the kingdom.',
  sprite: '0000',
  rarity: 'Legendary',
};

describe('Collectibles Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCollectibleQuantity', () => {
    it('returns the stored quantity', () => {
      vi.mocked(gamestate).mockReturnValue({
        collectibles: { [foundingStone.id]: { quantity: 3, foundAt: 1000 } },
      } as unknown as GameState);

      expect(getCollectibleQuantity(foundingStone.id)).toBe(3);
    });

    it('returns 0 when the collectible has never been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        collectibles: {},
      } as unknown as GameState);

      expect(getCollectibleQuantity(foundingStone.id)).toBe(0);
    });
  });

  describe('isCollectibleDiscovered', () => {
    it('returns true when foundAt is set', () => {
      vi.mocked(gamestate).mockReturnValue({
        collectibles: { [foundingStone.id]: { quantity: 1, foundAt: 1000 } },
      } as unknown as GameState);

      expect(isCollectibleDiscovered(foundingStone.id)).toBe(true);
    });

    it('returns false when the collectible has never been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        collectibles: {},
      } as unknown as GameState);

      expect(isCollectibleDiscovered(foundingStone.id)).toBe(false);
    });
  });

  describe('collectiblesAdd', () => {
    it('adds a new collectible entry with the current timestamp', () => {
      collectiblesAdd(foundingStone.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        collectibles: {},
      } as unknown as GameState);

      expect(result.collectibles[foundingStone.id].quantity).toBe(1);
      expect(result.collectibles[foundingStone.id].foundAt).toBeGreaterThan(0);
    });

    it('accumulates quantity and preserves the original foundAt', () => {
      collectiblesAdd(foundingStone.id, 2);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        collectibles: { [foundingStone.id]: { quantity: 1, foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.collectibles[foundingStone.id]).toEqual({
        quantity: 3,
        foundAt: 1000,
      });
    });

    it('does nothing for a zero or negative quantity', () => {
      collectiblesAdd(foundingStone.id, 0);
      collectiblesAdd(foundingStone.id, -1);

      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('sends an analytics event with the collectible name only the first time it is found', () => {
      vi.mocked(gamestate).mockReturnValue({
        collectibles: {},
      } as unknown as GameState);
      vi.mocked(getEntry).mockReturnValue(foundingStone);

      collectiblesAdd(foundingStone.id);

      expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
        'Progress:Museum:Unlock:Founding Stone',
      );
    });

    it('does not send an analytics event again once already discovered', () => {
      vi.mocked(gamestate).mockReturnValue({
        collectibles: { [foundingStone.id]: { quantity: 1, foundAt: 1000 } },
      } as unknown as GameState);

      collectiblesAdd(foundingStone.id, 2);

      expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
    });
  });

  describe('pruneInvalidCollectibles', () => {
    it('keeps entries that resolve to real collectible content', () => {
      vi.mocked(getEntry).mockReturnValue(foundingStone);
      const collectibles: GameStateCollectibles = {
        [foundingStone.id]: { quantity: 1, foundAt: 1000 },
      };

      expect(pruneInvalidCollectibles(collectibles)).toEqual(collectibles);
    });

    it('drops entries whose collectibleId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const collectibles: GameStateCollectibles = {
        [foundingStone.id]: { quantity: 1, foundAt: 1000 },
      };

      expect(pruneInvalidCollectibles(collectibles)).toEqual({});
    });
  });

  describe('grantFoundingStoneIfMissing', () => {
    it('grants the founding stone when the player does not have one', () => {
      vi.mocked(getEntry).mockReturnValue(foundingStone);

      const result = grantFoundingStoneIfMissing({});

      expect(result[foundingStone.id].quantity).toBe(1);
      expect(result[foundingStone.id].foundAt).toBeGreaterThan(0);
    });

    it('leaves an existing founding stone entry untouched', () => {
      vi.mocked(getEntry).mockReturnValue(foundingStone);
      const collectibles: GameStateCollectibles = {
        [foundingStone.id]: { quantity: 1, foundAt: 1000 },
      };

      expect(grantFoundingStoneIfMissing(collectibles)).toEqual(collectibles);
    });

    it('returns the input unchanged if founding stone content cannot be resolved', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      expect(grantFoundingStoneIfMissing({})).toEqual({});
    });
  });
});
