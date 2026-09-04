import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/town-tick', () => ({
  isTownDueForUpdate: vi.fn(),
  markTownSubsystemProcessed: vi.fn(),
}));

import { getEntriesByType } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { updateGamestate } from '@helpers/state-game';
import { townShopProcessTick } from '@helpers/town/shop/town-shop-tick';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type { GameState, TownContent, TownId } from '@interfaces';

const townId = 'larsia' as TownId;

function buildTown(itemExpirationTimer: number): TownContent {
  return {
    id: townId,
    traders: { itemExpirationTimer },
  } as unknown as TownContent;
}

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTownDueForUpdate).mockReturnValue(true);
});

describe('townShopProcessTick', () => {
  it('skips a town that is not due for the shop subsystem', () => {
    vi.mocked(isTownDueForUpdate).mockReturnValue(false);
    vi.mocked(getEntriesByType).mockReturnValue([buildTown(100)]);

    townShopProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(markTownSubsystemProcessed).not.toHaveBeenCalled();
  });

  it('does nothing for a town with expiration disabled (itemExpirationTimer <= 0)', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildTown(0)]);

    townShopProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(markTownSubsystemProcessed).toHaveBeenCalledWith(townId, 'shop');
  });

  it('drops stock entries that have aged past itemExpirationTimer', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildTown(100)]);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);

    townShopProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [
              { itemId: 'fresh', quantity: 1, addedAtTick: 450 }, // 50 old, under 100 - kept
              { itemId: 'stale', quantity: 1, addedAtTick: 300 }, // 200 old, over 100 - expired
            ],
          },
        },
      },
    } as unknown as GameState);

    expect(state.world.towns[townId].stock).toEqual([
      { itemId: 'fresh', quantity: 1, addedAtTick: 450 },
    ]);
    expect(markTownSubsystemProcessed).toHaveBeenCalledWith(townId, 'shop');
  });

  it('keeps an entry exactly at the boundary (age strictly less than the timer to survive)', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildTown(100)]);
    vi.mocked(timerTicksElapsed).mockReturnValue(400);

    townShopProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [{ itemId: 'boundary', quantity: 1, addedAtTick: 300 }], // exactly 100 old
          },
        },
      },
    } as unknown as GameState);

    expect(state.world.towns[townId].stock).toEqual([]);
  });
});
