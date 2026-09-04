import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  formatDuration: vi.fn((ticks) => `formatted:${ticks}`),
}));

vi.mock('@helpers/item/item-preview', () => ({
  resolveRewardDisplay: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { gamestate } from '@helpers/state-game';
import {
  townCraftQueueRows,
  townTradeskillLevelRows,
} from '@helpers/town/crafting/town-craft-display';
import type {
  GameState,
  RecipeContent,
  TownContent,
  TownId,
  TradeskillContent,
  TradeskillId,
} from '@interfaces';
import { ALL_TRADESKILLS } from '@interfaces';

const townId = 'larsia' as TownId;
const blacksmithingId = 'blacksmithing' as TradeskillId;

function buildTown(): TownContent {
  return {
    id: townId,
    crafting: {
      specialtyTradeskillId: blacksmithingId,
      craftingDurationMultiplier: 3,
    },
  } as unknown as TownContent;
}

function mockOnlyBlacksmithingResolves(town: TownContent | undefined): void {
  vi.mocked(getEntry).mockImplementation((idOrName: unknown) => {
    if (idOrName === townId) return town;
    if (idOrName === 'Blacksmithing') {
      return {
        id: blacksmithingId,
        name: 'Blacksmithing',
        sprite: '0001',
      } as TradeskillContent;
    }
    return undefined;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townTradeskillLevelRows', () => {
  it('returns an empty array when the town has no content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(townTradeskillLevelRows(townId)).toEqual([]);
  });

  it('skips any tradeskill whose content does not resolve', () => {
    const town = buildTown();
    mockOnlyBlacksmithingResolves(town);
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { tradeskills: {} } } },
    } as unknown as GameState);

    const rows = townTradeskillLevelRows(townId);

    // Only "Blacksmithing" resolves in this mock - the other 4 ALL_TRADESKILLS names don't.
    expect(rows).toHaveLength(1);
    expect(rows[0].tradeskillId).toBe(blacksmithingId);
  });

  it('marks the town-authored specialty tradeskill and defaults an absent level to 1', () => {
    const town = buildTown();
    mockOnlyBlacksmithingResolves(town);
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { tradeskills: {} } } },
    } as unknown as GameState);

    const [row] = townTradeskillLevelRows(townId);

    expect(row.isSpecialty).toBe(true);
    expect(row.level).toBe(1);
  });

  it('reads the real level once the tradeskill has live state', () => {
    const town = buildTown();
    mockOnlyBlacksmithingResolves(town);
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: { tradeskills: { [blacksmithingId]: { level: 7 } } },
        },
      },
    } as unknown as GameState);

    const [row] = townTradeskillLevelRows(townId);

    expect(row.level).toBe(7);
  });
});

describe('townCraftQueueRows', () => {
  it('returns an empty array when the town has no content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { craftQueue: [] } } },
    } as unknown as GameState);

    expect(townCraftQueueRows(townId)).toEqual([]);
  });

  it('returns an empty array when the town has no live state entry', () => {
    vi.mocked(getEntry).mockReturnValue(buildTown());
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    expect(townCraftQueueRows(townId)).toEqual([]);
  });

  it('skips a queue entry whose recipe or tradeskill no longer resolves', () => {
    const town = buildTown();
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === townId ? town : undefined,
    );
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'recipe-1',
                ticksIntoCraft: 2,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    expect(townCraftQueueRows(townId)).toEqual([]);
  });

  it('builds a row per queue entry, resolving the result display and remaining time via the town craft duration multiplier', () => {
    const town = buildTown();
    const result = { itemId: 'copper-ingot' };
    const display = { name: 'Copper Ingot', sprite: '01', rarity: 'Common' };
    vi.mocked(getEntry).mockImplementation((id: unknown) => {
      if (id === townId) return town;
      if (id === blacksmithingId) {
        return { id, name: 'Blacksmithing' } as TradeskillContent;
      }
      if (id === 'recipe-1') {
        return { craftTime: 5, result } as RecipeContent;
      }
      return undefined;
    });
    vi.mocked(resolveRewardDisplay).mockImplementation((reward) =>
      reward === result ? (display as never) : undefined,
    );
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'recipe-1',
                ticksIntoCraft: 2,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    const [row] = townCraftQueueRows(townId);

    // craftTime 5 * multiplier 3 = 15; remaining = 15 - 2 = 13.
    expect(row).toEqual({
      id: 'q1',
      tradeskillName: 'Blacksmithing',
      resultDisplay: display,
      remaining: 'formatted:13',
    });
  });
});

it('ALL_TRADESKILLS includes Blacksmithing', () => {
  expect(ALL_TRADESKILLS).toContain('Blacksmithing');
});
