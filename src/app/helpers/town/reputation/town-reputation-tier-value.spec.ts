import type * as TownReputationHelper from '@helpers/town/reputation/town-reputation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/reputation/town-reputation', async (importOriginal) => {
  const actual = await importOriginal<typeof TownReputationHelper>();
  return {
    ...actual,
    townReputationTier: vi.fn(),
  };
});

import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import { townReputationTierValueResolve } from '@helpers/town/reputation/town-reputation-tier-value';
import type { TownId } from '@interfaces';

const townId = 'larsia' as TownId;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townReputationTierValueResolve', () => {
  const tiers = [
    { tier: 0, value: 5 },
    { tier: 1, value: 7 },
    { tier: 2, value: 9 },
  ];

  it.each([
    [0, 5],
    [1, 7],
    [2, 9],
  ])('resolves tier %i to a value of %i', (tier, expected) => {
    vi.mocked(townReputationTier).mockReturnValue(tier);
    expect(townReputationTierValueResolve(townId, tiers)).toBe(expected);
  });

  it('falls back to the highest authored tier at or below the current one when a tier is missing', () => {
    vi.mocked(townReputationTier).mockReturnValue(2);
    expect(
      townReputationTierValueResolve(townId, [
        { tier: 0, value: 5 },
        { tier: 3, value: 11 },
      ]),
    ).toBe(5);
  });

  it('is 0 when no tier at or below the current one is authored', () => {
    vi.mocked(townReputationTier).mockReturnValue(2);
    expect(townReputationTierValueResolve(townId, [])).toBe(0);
  });
});
