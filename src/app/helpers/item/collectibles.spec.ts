import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { ensureCollectible } from '@helpers/content/ensure-item';
import { defaultGameState } from '@helpers/defaults';
import {
  applyCollectibleGrant,
  collectiblesAdd,
  discoveredCollectibleCount,
  getCollectibleQuantity,
  grantFoundingStoneIfMissing,
  isCollectibleDiscovered,
  pruneInvalidCollectibles,
} from '@helpers/item/collectibles';
import { gamestate } from '@helpers/state-game';
import { taskEventCollectibleGained } from '@helpers/task/task-events';
import type { CollectibleId } from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const stoneId = 'founding-stone' as CollectibleId;
const chestId = 'big-chest' as CollectibleId;
const staleId = 'stale' as CollectibleId;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(5000);
  seedContent([
    ensureCollectible({ id: stoneId, name: 'Founding Stone' }),
    ensureCollectible({
      id: chestId,
      name: 'Big Chest',
      effects: [{ effectType: 'GlobalArmorySizeBoost', value: 10 }],
    }),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reading the collection', () => {
  it('reports quantity, discovery and the discovered count', () => {
    seedGamestate((state) => {
      state.collectibles[stoneId] = { quantity: 3, foundAt: 1000 };
      state.collectibles[chestId] = { quantity: 1, foundAt: 0 };
    });

    expect(getCollectibleQuantity(stoneId)).toBe(3);
    expect(isCollectibleDiscovered(stoneId)).toBe(true);
    expect(isCollectibleDiscovered(chestId)).toBe(false);
    expect(discoveredCollectibleCount()).toBe(1);
  });

  it('is empty for a collectible never found', () => {
    seedGamestate();

    expect(getCollectibleQuantity(stoneId)).toBe(0);
    expect(discoveredCollectibleCount()).toBe(0);
  });
});

describe('applyCollectibleGrant', () => {
  it('creates a new entry stamped now', () => {
    const state = defaultGameState();

    applyCollectibleGrant(state, stoneId, 1);

    expect(state.collectibles[stoneId]).toEqual({ quantity: 1, foundAt: 5000 });
  });

  it('merges quantity and preserves the original foundAt', () => {
    const state = defaultGameState();
    state.collectibles[stoneId] = { quantity: 1, foundAt: 1000 };

    applyCollectibleGrant(state, stoneId, 2);

    expect(state.collectibles[stoneId]).toEqual({ quantity: 3, foundAt: 1000 });
  });

  it("applies the collectible's global effects immediately", () => {
    const state = defaultGameState();

    applyCollectibleGrant(state, chestId, 1);

    expect(state.globalEffectSums.armorySizeBoost).toBe(10);
  });
});

describe('collectiblesAdd', () => {
  it('adds to the collection and fires the task event', () => {
    seedGamestate((state) => {
      state.collectibles[stoneId] = { quantity: 1, foundAt: 1000 };
    });

    inTick(() => collectiblesAdd(stoneId, 2));

    expect(gamestate().collectibles[stoneId]).toEqual({
      quantity: 3,
      foundAt: 1000,
    });
    expect(taskEventCollectibleGained).toHaveBeenCalledWith(stoneId);
  });

  it('does nothing for a zero or negative quantity', () => {
    const before = seedGamestate();

    inTick(() => {
      collectiblesAdd(stoneId, 0);
      collectiblesAdd(stoneId, -1);
    });

    expect(gamestate()).toBe(before);
  });

  it('sends the museum unlock event only the first time it is found', () => {
    seedGamestate();
    const events = captureAnalyticsEvents();

    inTick(() => {
      collectiblesAdd(stoneId);
      collectiblesAdd(stoneId);
    });

    expect(events).toEqual(['Progress:Museum:Unlock:Founding Stone']);
  });
});

describe('pruneInvalidCollectibles', () => {
  it('drops only the entries that no longer resolve to content', () => {
    expect(
      pruneInvalidCollectibles({
        [stoneId]: { quantity: 1, foundAt: 1000 },
        [staleId]: { quantity: 1, foundAt: 1000 },
      }),
    ).toEqual({ [stoneId]: { quantity: 1, foundAt: 1000 } });
  });
});

describe('grantFoundingStoneIfMissing', () => {
  it('grants the founding stone when the player does not have one', () => {
    expect(grantFoundingStoneIfMissing({})).toEqual({
      [stoneId]: { quantity: 1, foundAt: 5000 },
    });
  });

  it('leaves an existing founding stone entry untouched', () => {
    const collectibles = { [stoneId]: { quantity: 4, foundAt: 1000 } };

    expect(grantFoundingStoneIfMissing(collectibles)).toEqual(collectibles);
  });

  it('returns the input unchanged if the founding stone content is missing', () => {
    seedContent([]);
    const collectibles = { [chestId]: { quantity: 1, foundAt: 1000 } };

    expect(grantFoundingStoneIfMissing(collectibles)).toEqual(collectibles);
  });
});
