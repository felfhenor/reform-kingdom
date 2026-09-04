import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(),
}));

import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  pruneInvalidTownCraftQueue,
  pruneInvalidTownTradeskills,
  townTradeskillsMaterialize,
} from '@helpers/town/crafting/town-craft-tradeskills';
import type {
  RecipeContent,
  TownContent,
  TownId,
  TownTradeskillState,
  TradeskillContent,
  TradeskillId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const blacksmithingId = 'blacksmithing' as TradeskillId;
const woodworkingId = 'woodworking' as TradeskillId;

function buildTown(
  tradeskillLevels: { tradeskillId: TradeskillId; level: number }[] = [],
): TownContent {
  return { id: townId, crafting: { tradeskillLevels } } as unknown as TownContent;
}

function mockContentFor(town: TownContent | undefined): void {
  vi.mocked(getEntry).mockImplementation((id: unknown) =>
    id === townId ? town : undefined,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townTradeskillsMaterialize', () => {
  it('returns existing unchanged when the town content no longer resolves', () => {
    mockContentFor(undefined);
    const existing = { [blacksmithingId]: { level: 5, xp: { current: 0, maximum: 10 } } };

    expect(townTradeskillsMaterialize(townId, existing)).toBe(existing);
  });

  it('fills in a default (level 1) entry for every tradeskill the town has no seed for', () => {
    mockContentFor(buildTown());
    vi.mocked(getEntriesByType).mockReturnValue([
      { id: blacksmithingId } as TradeskillContent,
      { id: woodworkingId } as TradeskillContent,
    ]);

    const result = townTradeskillsMaterialize(townId, {});

    expect(result[blacksmithingId]).toEqual({
      level: 1,
      xp: { current: 0, maximum: expect.any(Number) },
    });
    expect(result[woodworkingId].level).toBe(1);
  });

  it('materializes a missing entry at the town-authored seed level', () => {
    mockContentFor(
      buildTown([{ tradeskillId: blacksmithingId, level: 12 }]),
    );
    vi.mocked(getEntriesByType).mockReturnValue([
      { id: blacksmithingId } as TradeskillContent,
    ]);

    const result = townTradeskillsMaterialize(townId, {});

    expect(result[blacksmithingId].level).toBe(12);
  });

  it('never overwrites an existing entry already at or above the seed level', () => {
    mockContentFor(
      buildTown([{ tradeskillId: blacksmithingId, level: 5 }]),
    );
    vi.mocked(getEntriesByType).mockReturnValue([
      { id: blacksmithingId } as TradeskillContent,
    ]);
    const existing: TownTradeskillState = { level: 12, xp: { current: 3, maximum: 20 } };

    const result = townTradeskillsMaterialize(townId, {
      [blacksmithingId]: existing,
    });

    expect(result[blacksmithingId]).toBe(existing);
  });

  it('raises an existing entry below the seed level up to the floor', () => {
    mockContentFor(
      buildTown([{ tradeskillId: blacksmithingId, level: 12 }]),
    );
    vi.mocked(getEntriesByType).mockReturnValue([
      { id: blacksmithingId } as TradeskillContent,
    ]);
    const existing: TownTradeskillState = { level: 3, xp: { current: 7, maximum: 15 } };

    const result = townTradeskillsMaterialize(townId, {
      [blacksmithingId]: existing,
    });

    expect(result[blacksmithingId].level).toBe(12);
    expect(result[blacksmithingId].xp.current).toBe(0);
  });
});

describe('pruneInvalidTownTradeskills', () => {
  it('drops entries whose tradeskillId no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    const result = pruneInvalidTownTradeskills({
      [blacksmithingId]: { level: 1, xp: { current: 0, maximum: 10 } },
    });

    expect(result).toEqual({});
  });

  it('keeps entries whose tradeskillId still resolves', () => {
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === blacksmithingId ? ({ id } as TradeskillContent) : undefined,
    );
    const state: TownTradeskillState = { level: 4, xp: { current: 1, maximum: 10 } };

    const result = pruneInvalidTownTradeskills({ [blacksmithingId]: state });

    expect(result[blacksmithingId]).toBe(state);
  });
});

describe('pruneInvalidTownCraftQueue', () => {
  it('drops entries whose tradeskillId no longer resolves', () => {
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === 'real-recipe' ? ({ id } as RecipeContent) : undefined,
    );

    const result = pruneInvalidTownCraftQueue([
      {
        id: 'q1' as never,
        tradeskillId: 'removed' as never,
        recipeId: 'real-recipe' as never,
        ticksIntoCraft: 0,
      },
    ]);

    expect(result).toEqual([]);
  });

  it('drops entries whose recipeId no longer resolves', () => {
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === blacksmithingId ? ({ id } as TradeskillContent) : undefined,
    );

    const result = pruneInvalidTownCraftQueue([
      {
        id: 'q1' as never,
        tradeskillId: blacksmithingId,
        recipeId: 'removed-recipe' as never,
        ticksIntoCraft: 0,
      },
    ]);

    expect(result).toEqual([]);
  });

  it('keeps an entry whose tradeskillId and recipeId both resolve', () => {
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === blacksmithingId || id === 'real-recipe'
        ? ({ id } as TradeskillContent)
        : undefined,
    );
    const entry = {
      id: 'q1' as never,
      tradeskillId: blacksmithingId,
      recipeId: 'real-recipe' as never,
      ticksIntoCraft: 3,
    };

    expect(pruneInvalidTownCraftQueue([entry])).toEqual([entry]);
  });
});
