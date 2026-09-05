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
  return {
    id: townId,
    crafting: { tradeskillLevels },
  } as unknown as TownContent;
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
    const existing = { [blacksmithingId]: { level: 5 } };

    expect(townTradeskillsMaterialize(townId, existing)).toBe(existing);
  });

  it('defaults to level 1 for every tradeskill the town has no seed for', () => {
    mockContentFor(buildTown());
    vi.mocked(getEntriesByType).mockReturnValue([
      { id: blacksmithingId } as TradeskillContent,
      { id: woodworkingId } as TradeskillContent,
    ]);

    const result = townTradeskillsMaterialize(townId, {});

    expect(result[blacksmithingId]).toEqual({ level: 1 });
    expect(result[woodworkingId]).toEqual({ level: 1 });
  });

  it('syncs a tradeskill to its town-authored seed level', () => {
    mockContentFor(buildTown([{ tradeskillId: blacksmithingId, level: 12 }]));
    vi.mocked(getEntriesByType).mockReturnValue([
      { id: blacksmithingId } as TradeskillContent,
    ]);

    const result = townTradeskillsMaterialize(townId, {});

    expect(result[blacksmithingId]).toEqual({ level: 12 });
  });

  it('overwrites an existing level that no longer matches the authored seed, in either direction', () => {
    mockContentFor(buildTown([{ tradeskillId: blacksmithingId, level: 12 }]));
    vi.mocked(getEntriesByType).mockReturnValue([
      { id: blacksmithingId } as TradeskillContent,
    ]);

    const raised = townTradeskillsMaterialize(townId, {
      [blacksmithingId]: { level: 3 },
    });
    expect(raised[blacksmithingId]).toEqual({ level: 12 });

    const lowered = townTradeskillsMaterialize(townId, {
      [blacksmithingId]: { level: 40 },
    });
    expect(lowered[blacksmithingId]).toEqual({ level: 12 });
  });

  it('clamps a seed level above TRADESKILL_MAX_LEVEL down to the cap', () => {
    mockContentFor(buildTown([{ tradeskillId: blacksmithingId, level: 999 }]));
    vi.mocked(getEntriesByType).mockReturnValue([
      { id: blacksmithingId } as TradeskillContent,
    ]);

    const result = townTradeskillsMaterialize(townId, {});

    expect(result[blacksmithingId]).toEqual({ level: 50 });
  });
});

describe('pruneInvalidTownTradeskills', () => {
  it('drops entries whose tradeskillId no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    const result = pruneInvalidTownTradeskills({
      [blacksmithingId]: { level: 1 },
    });

    expect(result).toEqual({});
  });

  it('keeps entries whose tradeskillId still resolves', () => {
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === blacksmithingId ? ({ id } as TradeskillContent) : undefined,
    );
    const state: TownTradeskillState = { level: 4 };

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
