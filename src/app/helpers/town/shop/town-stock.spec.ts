import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(() => 0),
  formatDuration: vi.fn((ticks) => `formatted:${ticks}`),
}));

vi.mock('@helpers/item/item-preview', () => ({
  resolveRewardDisplay: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { timerTicksElapsed } from '@helpers/engine/timer';
import { getEntry } from '@helpers/content/content';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { gamestate } from '@helpers/state-game';
import {
  applyTownStockAdd,
  pruneInvalidTownStock,
  townStock,
  townStockBonusCombatStats,
  townStockBonusResistances,
  townStockBonusStats,
  townStockDisplay,
  townStockExpiresIn,
} from '@helpers/town/shop/town-stock';
import type {
  AffixContent,
  EquipmentContent,
  GameState,
  ItemContent,
  ItemPreviewDisplay,
  ItemId,
  TownContent,
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
  it('delegates to the shared resolveRewardDisplay resolver for an item entry', () => {
    const display = { name: 'Gold Coin' } as ItemPreviewDisplay;
    vi.mocked(resolveRewardDisplay).mockReturnValue(display);
    const entry = { itemId: 'gold-coin' as never, quantity: 1 };

    expect(townStockDisplay(entry)).toBe(display);
    expect(resolveRewardDisplay).toHaveBeenCalledWith({ itemId: 'gold-coin' });
  });

  it('delegates to the shared resolveRewardDisplay resolver for an equipment entry with no affixes', () => {
    const display = { name: 'Iron Sword' } as ItemPreviewDisplay;
    vi.mocked(resolveRewardDisplay).mockReturnValue(display);
    const entry = {
      equipmentItem: {
        equipmentId: 'sword' as never,
        affixIds: [],
      } as never,
    };

    expect(townStockDisplay(entry)).toEqual(display);
    expect(resolveRewardDisplay).toHaveBeenCalledWith({ equipmentId: 'sword' });
  });

  it("folds a rolled equipment entry's affixes into the display name", () => {
    const display = { name: 'Iron Sword' } as ItemPreviewDisplay;
    vi.mocked(resolveRewardDisplay).mockReturnValue(display);
    vi.mocked(getEntry).mockReturnValue({
      name: 'Flaming',
      position: 'Prefix',
    } as AffixContent);
    const entry = {
      equipmentItem: {
        equipmentId: 'sword' as never,
        affixIds: ['flaming' as never],
      } as never,
    };

    expect(townStockDisplay(entry)).toEqual({
      ...display,
      name: 'Flaming Iron Sword',
    });
  });

  it('returns undefined without touching affixes when the base content no longer resolves', () => {
    vi.mocked(resolveRewardDisplay).mockReturnValue(undefined);
    const entry = {
      equipmentItem: { equipmentId: 'removed' as never, affixIds: [] } as never,
    };

    expect(townStockDisplay(entry)).toBeUndefined();
  });
});

describe('townStockBonusStats / townStockBonusResistances / townStockBonusCombatStats', () => {
  it('returns undefined for a stacked item entry, which has nothing to roll', () => {
    const entry = { itemId: 'gold-coin' as never, quantity: 1 };

    expect(townStockBonusStats(entry)).toBeUndefined();
    expect(townStockBonusResistances(entry)).toBeUndefined();
    expect(townStockBonusCombatStats(entry)).toBeUndefined();
  });

  it('resolves a zeroed bonus block for an equipment entry with no affixes or infusions', () => {
    const entry = {
      equipmentItem: {
        equipmentId: 'sword' as never,
        affixIds: [],
        infusedItemIds: [],
      } as never,
    };

    expect(townStockBonusStats(entry)).toBeDefined();
    expect(townStockBonusResistances(entry)).toBeDefined();
    expect(townStockBonusCombatStats(entry)).toBeDefined();
  });
});

describe('pruneInvalidTownStock', () => {
  it('keeps an item entry that still resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue({} as ItemContent);
    const entry = { itemId: 'gold-coin' as never, quantity: 1, addedAtTick: 5 };

    expect(pruneInvalidTownStock([entry])).toEqual([entry]);
  });

  it('keeps an equipment entry that still resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue({} as EquipmentContent);
    const entry = {
      equipmentItem: { equipmentId: 'sword' as never } as never,
      addedAtTick: 5,
    };

    expect(pruneInvalidTownStock([entry])).toEqual([entry]);
  });

  it('drops an item entry whose itemId no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const entry = { itemId: 'removed-item' as never, quantity: 1, addedAtTick: 5 };

    expect(pruneInvalidTownStock([entry])).toEqual([]);
  });

  it('drops an equipment entry whose equipmentId no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const entry = {
      equipmentItem: { equipmentId: 'removed-sword' as never } as never,
      addedAtTick: 5,
    };

    expect(pruneInvalidTownStock([entry])).toEqual([]);
  });

  it('backfills a missing addedAtTick (a legacy save) to the current tick rather than zero', () => {
    vi.mocked(getEntry).mockReturnValue({} as ItemContent);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const entry = { itemId: 'gold-coin' as never, quantity: 1 } as never;

    expect(pruneInvalidTownStock([entry])).toEqual([
      { itemId: 'gold-coin', quantity: 1, addedAtTick: 500 },
    ]);
  });
});

describe('townStockExpiresIn', () => {
  function buildTown(itemExpirationTimer: number): TownContent {
    return { traders: { itemExpirationTimer } } as unknown as TownContent;
  }

  it('returns undefined when the town has expiration disabled (itemExpirationTimer <= 0)', () => {
    const entry = { itemId: 'gold-coin' as never, quantity: 1, addedAtTick: 0 };

    expect(townStockExpiresIn(entry, buildTown(0))).toBeUndefined();
  });

  it('formats the remaining ticks until expiration', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(120);
    const entry = { itemId: 'gold-coin' as never, quantity: 1, addedAtTick: 20 };

    // itemExpirationTimer 1000 - (nowTick 120 - addedAtTick 20) = 900 remaining.
    expect(townStockExpiresIn(entry, buildTown(1000))).toBe('formatted:900');
  });
});

describe('applyTownStockAdd', () => {
  const oreId = 'ore' as ItemId;

  function buildState(stock: unknown[]): GameState {
    return {
      world: { towns: { [townId]: { stock } } },
    } as unknown as GameState;
  }

  it('stacks onto an existing entry with the same itemId, resetting its addedAtTick to now', () => {
    const state = buildState([{ itemId: oreId, quantity: 5, addedAtTick: 3 }]);
    vi.mocked(timerTicksElapsed).mockReturnValue(999);

    applyTownStockAdd(state, townId, { itemId: oreId, quantity: 3 }, 10);

    expect(state.world.towns[townId].stock).toEqual([
      { itemId: oreId, quantity: 8, addedAtTick: 999 },
    ]);
  });

  it('appends a new entry stamped with the current tick when no matching itemId exists yet', () => {
    const state = buildState([]);
    vi.mocked(timerTicksElapsed).mockReturnValue(42);

    applyTownStockAdd(state, townId, { itemId: oreId, quantity: 3 }, 10);

    expect(state.world.towns[townId].stock).toEqual([
      { itemId: oreId, quantity: 3, addedAtTick: 42 },
    ]);
  });

  it('always appends equipment as its own new entry, never merged, stamped with the current tick', () => {
    const equipmentItem = { id: 'sword-1' } as never;
    const state = buildState([]);
    vi.mocked(timerTicksElapsed).mockReturnValue(42);

    applyTownStockAdd(state, townId, { equipmentItem }, 10);

    expect(state.world.towns[townId].stock).toEqual([
      { equipmentItem, addedAtTick: 42 },
    ]);
  });

  it('does not append a new entry once at cap', () => {
    const state = buildState([
      { itemId: 'other' as ItemId, quantity: 1, addedAtTick: 0 },
    ]);

    applyTownStockAdd(state, townId, { itemId: oreId, quantity: 3 }, 1);

    expect(state.world.towns[townId].stock).toEqual([
      { itemId: 'other', quantity: 1, addedAtTick: 0 },
    ]);
  });

  it('still stacks onto an existing entry even at cap, resetting its addedAtTick', () => {
    const state = buildState([{ itemId: oreId, quantity: 5, addedAtTick: 0 }]);
    vi.mocked(timerTicksElapsed).mockReturnValue(777);

    applyTownStockAdd(state, townId, { itemId: oreId, quantity: 3 }, 1);

    expect(state.world.towns[townId].stock).toEqual([
      { itemId: oreId, quantity: 8, addedAtTick: 777 },
    ]);
  });

  it('does nothing when the town has no state entry', () => {
    const state = { world: { towns: {} } } as unknown as GameState;

    expect(() =>
      applyTownStockAdd(state, townId, { itemId: oreId, quantity: 1 }, 10),
    ).not.toThrow();
    expect(state.world.towns[townId]).toBeUndefined();
  });
});
