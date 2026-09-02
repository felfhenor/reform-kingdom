import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/item/item-preview', () => ({
  resolveRewardDisplay: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { gamestate } from '@helpers/state-game';
import {
  pruneInvalidTownStock,
  townStock,
  townStockDisplay,
} from '@helpers/town/shop/town-stock';
import type {
  EquipmentContent,
  GameState,
  ItemContent,
  ItemPreviewDisplay,
  TownId,
} from '@interfaces';

const townId = 'larsia' as TownId;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townStock', () => {
  it("reads the town's stock array", () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { stock: [{ quantity: 5 }] } } },
    } as unknown as GameState);

    expect(townStock(townId)).toEqual([{ quantity: 5 }]);
  });

  it('returns an empty array when the town has no state entry', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    expect(townStock(townId)).toEqual([]);
  });
});

describe('townStockDisplay', () => {
  it('delegates to the shared resolveRewardDisplay resolver', () => {
    const display = { name: 'Gold Coin' } as ItemPreviewDisplay;
    vi.mocked(resolveRewardDisplay).mockReturnValue(display);
    const entry = { itemId: 'gold-coin' as never, quantity: 1 };

    expect(townStockDisplay(entry)).toBe(display);
    expect(resolveRewardDisplay).toHaveBeenCalledWith(entry);
  });
});

describe('pruneInvalidTownStock', () => {
  it('keeps an item entry that still resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue({} as ItemContent);
    const entry = { itemId: 'gold-coin' as never, quantity: 1 };

    expect(pruneInvalidTownStock([entry])).toEqual([entry]);
  });

  it('keeps an equipment entry that still resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue({} as EquipmentContent);
    const entry = { equipmentId: 'sword' as never, quantity: 1 };

    expect(pruneInvalidTownStock([entry])).toEqual([entry]);
  });

  it('drops an entry whose referenced id no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const entry = { itemId: 'removed-item' as never, quantity: 1 };

    expect(pruneInvalidTownStock([entry])).toEqual([]);
  });

  it('drops an entry with neither itemId nor equipmentId', () => {
    expect(pruneInvalidTownStock([{ quantity: 1 }])).toEqual([]);
  });
});
