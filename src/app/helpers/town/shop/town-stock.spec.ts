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
  ItemPreviewDisplay,
  TownContent,
  TownId,
  TownStockEntry,
} from '@interfaces';

const townId = 'larsia' as TownId;

function buildEntry(
  overrides: Partial<TownStockEntry['equipmentItem']> = {},
  addedAtTick = 0,
): TownStockEntry {
  return {
    equipmentItem: {
      id: 'item-1' as never,
      equipmentId: 'sword' as never,
      infusedItemIds: [],
      affixIds: [],
      ...overrides,
    },
    addedAtTick,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townStock', () => {
  it("reads the town's stock array", () => {
    const stock = [buildEntry()];
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { stock } } },
    } as unknown as GameState);

    expect(townStock(townId)).toEqual(stock);
  });

  it('returns an empty array when the town has no state entry', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    expect(townStock(townId)).toEqual([]);
  });
});

describe('townStockDisplay', () => {
  it('delegates to the shared resolveRewardDisplay resolver for an entry with no affixes', () => {
    const display = { name: 'Iron Sword' } as ItemPreviewDisplay;
    vi.mocked(resolveRewardDisplay).mockReturnValue(display);
    const entry = buildEntry({ equipmentId: 'sword' as never });

    expect(townStockDisplay(entry)).toEqual(display);
    expect(resolveRewardDisplay).toHaveBeenCalledWith({ equipmentId: 'sword' });
  });

  it("folds a rolled entry's affixes into the display name", () => {
    const display = { name: 'Iron Sword' } as ItemPreviewDisplay;
    vi.mocked(resolveRewardDisplay).mockReturnValue(display);
    vi.mocked(getEntry).mockReturnValue({
      name: 'Flaming',
      position: 'Prefix',
    } as AffixContent);
    const entry = buildEntry({ affixIds: ['flaming' as never] });

    expect(townStockDisplay(entry)).toEqual({
      ...display,
      name: 'Flaming Iron Sword',
    });
  });

  it('returns undefined without touching affixes when the base content no longer resolves', () => {
    vi.mocked(resolveRewardDisplay).mockReturnValue(undefined);
    const entry = buildEntry({ equipmentId: 'removed' as never });

    expect(townStockDisplay(entry)).toBeUndefined();
  });
});

describe('townStockBonusStats / townStockBonusResistances / townStockBonusCombatStats', () => {
  it('resolves a zeroed bonus block for an entry with no affixes or infusions', () => {
    const entry = buildEntry();

    expect(townStockBonusStats(entry)).toBeDefined();
    expect(townStockBonusResistances(entry)).toBeDefined();
    expect(townStockBonusCombatStats(entry)).toBeDefined();
  });
});

describe('pruneInvalidTownStock', () => {
  it('keeps an entry that still resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue({} as EquipmentContent);
    const entry = buildEntry({}, 5);

    expect(pruneInvalidTownStock([entry])).toEqual([entry]);
  });

  it('drops an entry whose equipmentId no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const entry = buildEntry({ equipmentId: 'removed-sword' as never }, 5);

    expect(pruneInvalidTownStock([entry])).toEqual([]);
  });

  it('drops a pre-refactor itemId-shaped entry instead of throwing on the missing equipmentItem', () => {
    vi.mocked(getEntry).mockReturnValue({} as EquipmentContent);
    const legacyEntry = {
      itemId: 'ingot',
      quantity: 3,
      addedAtTick: 5,
    } as unknown as TownStockEntry;

    expect(pruneInvalidTownStock([legacyEntry])).toEqual([]);
  });

  it('backfills a missing addedAtTick (a legacy save) to the current tick rather than zero', () => {
    vi.mocked(getEntry).mockReturnValue({} as EquipmentContent);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const { equipmentItem } = buildEntry();
    const withoutTick = { equipmentItem };

    expect(pruneInvalidTownStock([withoutTick as TownStockEntry])).toEqual([
      { ...withoutTick, addedAtTick: 500 },
    ]);
  });
});

describe('townStockExpiresIn', () => {
  function buildTown(itemExpirationTimer: number): TownContent {
    return { traders: { itemExpirationTimer } } as unknown as TownContent;
  }

  it('returns undefined when the town has expiration disabled (itemExpirationTimer <= 0)', () => {
    const entry = buildEntry({}, 0);

    expect(townStockExpiresIn(entry, buildTown(0))).toBeUndefined();
  });

  it('formats the remaining ticks until expiration', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(120);
    const entry = buildEntry({}, 20);

    // itemExpirationTimer 1000 - (nowTick 120 - addedAtTick 20) = 900 remaining.
    expect(townStockExpiresIn(entry, buildTown(1000))).toBe('formatted:900');
  });
});

describe('applyTownStockAdd', () => {
  function buildState(stock: unknown[]): GameState {
    return {
      world: { towns: { [townId]: { stock } } },
    } as unknown as GameState;
  }

  it('always appends as its own new entry, stamped with the current tick', () => {
    const equipmentItem = { id: 'sword-1' } as never;
    const state = buildState([]);
    vi.mocked(timerTicksElapsed).mockReturnValue(42);

    applyTownStockAdd(state, townId, { equipmentItem }, 10);

    expect(state.world.towns[townId].stock).toEqual([
      { equipmentItem, addedAtTick: 42 },
    ]);
  });

  it('does not append a new entry once at cap', () => {
    const existing = buildEntry({}, 0);
    const state = buildState([existing]);

    applyTownStockAdd(state, townId, { equipmentItem: { id: 'new' } as never }, 1);

    expect(state.world.towns[townId].stock).toEqual([existing]);
  });

  it('does nothing when the town has no state entry', () => {
    const state = { world: { towns: {} } } as unknown as GameState;

    expect(() =>
      applyTownStockAdd(
        state,
        townId,
        { equipmentItem: { id: 'new' } as never },
        10,
      ),
    ).not.toThrow();
    expect(state.world.towns[townId]).toBeUndefined();
  });
});
