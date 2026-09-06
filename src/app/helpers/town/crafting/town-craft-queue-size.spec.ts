import type * as TownReputationHelper from '@helpers/town/reputation/town-reputation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/reputation/town-reputation', async (importOriginal) => {
  const actual = await importOriginal<typeof TownReputationHelper>();
  return {
    ...actual,
    townReputationTier: vi.fn(),
  };
});

import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import { townCraftQueueSize } from '@helpers/town/crafting/town-craft-queue-size';
import type { TownContent, TownId } from '@interfaces';

function buildTown(
  maxQueueSize: TownContent['crafting']['maxQueueSize'],
): TownContent {
  return {
    id: 'larsia' as TownId,
    crafting: { maxQueueSize } as never,
  } as unknown as TownContent;
}

describe('townCraftQueueSize', () => {
  const town = buildTown([
    { tier: 0, value: 12 },
    { tier: 1, value: 14 },
    { tier: 2, value: 16 },
    { tier: 3, value: 18 },
    { tier: 4, value: 20 },
  ]);

  it.each([
    [0, 12],
    [1, 14],
    [2, 16],
    [3, 18],
    [4, 20],
  ])('resolves tier %i to a queue size of %i', (tier, expected) => {
    vi.mocked(townReputationTier).mockReturnValue(tier);
    expect(townCraftQueueSize(town)).toBe(expected);
  });

  it('falls back to the highest authored tier at or below the current one when a tier is missing', () => {
    const sparseTown = buildTown([
      { tier: 0, value: 10 },
      { tier: 3, value: 15 },
    ]);
    vi.mocked(townReputationTier).mockReturnValue(2);

    expect(townCraftQueueSize(sparseTown)).toBe(10);
  });

  it('is 0 when no tier at or below the current one is authored', () => {
    const emptyTown = buildTown([]);
    vi.mocked(townReputationTier).mockReturnValue(2);

    expect(townCraftQueueSize(emptyTown)).toBe(0);
  });
});
