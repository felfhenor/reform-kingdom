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

import { getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { gamestate } from '@helpers/state-game';
import {
  applyTownStockAdd,
  pruneInvalidTownStock,
  townStock,
  townStockDisplay,
} from '@helpers/town/shop/town-stock';
import type {
  AffixContent,
  EquipmentContent,
  GameState,
  ItemPreviewDisplay,
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

    applyTownStockAdd(
      state,
      townId,
      { equipmentItem: { id: 'new' } as never },
      1,
    );

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
