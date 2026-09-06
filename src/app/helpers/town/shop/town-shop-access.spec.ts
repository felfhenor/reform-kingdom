import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

import type * as TownReputationHelper from '@helpers/town/reputation/town-reputation';

vi.mock('@helpers/town/reputation/town-reputation', async (importOriginal) => {
  const actual = await importOriginal<typeof TownReputationHelper>();
  return {
    ...actual,
    townReputationTier: vi.fn(),
  };
});

import { getEntry } from '@helpers/content/content';
import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import type { TownContent, TownId } from '@interfaces';

const townId = 'larsia' as TownId;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townShopItemCap', () => {
  it.each([
    [0, 5],
    [1, 7],
    [2, 9],
    [3, 11],
    [4, 13],
  ])('resolves tier %i to an item cap of %i', (tier, expected) => {
    vi.mocked(getEntry).mockReturnValue({
      traders: {
        sellItemCount: [
          { tier: 0, value: 5 },
          { tier: 1, value: 7 },
          { tier: 2, value: 9 },
          { tier: 3, value: 11 },
          { tier: 4, value: 13 },
        ],
      },
    } as TownContent);
    vi.mocked(townReputationTier).mockReturnValue(tier);

    expect(townShopItemCap(townId)).toBe(expected);
  });

  it('falls back to the highest authored tier at or below the current one when a tier is missing', () => {
    vi.mocked(getEntry).mockReturnValue({
      traders: {
        sellItemCount: [
          { tier: 0, value: 5 },
          { tier: 3, value: 11 },
        ],
      },
    } as TownContent);
    vi.mocked(townReputationTier).mockReturnValue(2);

    expect(townShopItemCap(townId)).toBe(5);
  });

  it('is 0 when no tier at or below the current one is authored', () => {
    vi.mocked(getEntry).mockReturnValue({
      traders: { sellItemCount: [] },
    } as unknown as TownContent);
    vi.mocked(townReputationTier).mockReturnValue(2);

    expect(townShopItemCap(townId)).toBe(0);
  });

  it('returns 0 when the town no longer resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(townShopItemCap(townId)).toBe(0);
  });
});
