import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/materials', () => ({
  goldCoinId: vi.fn(() => goldCoinItemId),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { gamestate } from '@helpers/state-game';
import {
  townGoldThreshold,
  townMaterialAtOrAboveThreshold,
  townMaterialThreshold,
} from '@helpers/town/town-resource-thresholds';
import type { GameState, ItemId, TownContent, TownId } from '@interfaces';

const townId = 'larsia' as TownId;
const oreId = 'copper-ore' as ItemId;
const goldCoinItemId = 'gold-coin' as ItemId;

function buildTown(
  materialThresholds: { itemId: ItemId; maxQuantity: number }[],
): TownContent {
  return {
    id: townId,
    gathering: { materialThresholds },
  } as unknown as TownContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(gamestate).mockReturnValue({
    world: { towns: { [townId]: { materials: {} } } },
  } as unknown as GameState);
});

describe('townMaterialThreshold', () => {
  it('resolves the authored cap for an item', () => {
    const town = buildTown([{ itemId: oreId, maxQuantity: 200 }]);

    expect(townMaterialThreshold(town, oreId)).toBe(200);
  });

  it('is undefined for an item with no authored entry - uncapped, not zero', () => {
    const town = buildTown([]);

    expect(townMaterialThreshold(town, oreId)).toBeUndefined();
  });

  it('does not leak one town object into another', () => {
    const townA = buildTown([{ itemId: oreId, maxQuantity: 100 }]);
    const townB = { ...buildTown([]), id: 'otherTown' as TownId };

    expect(townMaterialThreshold(townA, oreId)).toBe(100);
    expect(townMaterialThreshold(townB, oreId)).toBeUndefined();
  });
});

describe('townMaterialAtOrAboveThreshold', () => {
  it('is false when the item has no authored cap', () => {
    const town = buildTown([]);

    expect(townMaterialAtOrAboveThreshold(town, oreId)).toBe(false);
  });

  it('is false when below the cap', () => {
    const town = buildTown([{ itemId: oreId, maxQuantity: 200 }]);
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { materials: { [oreId]: 100 } } } },
    } as unknown as GameState);

    expect(townMaterialAtOrAboveThreshold(town, oreId)).toBe(false);
  });

  it('is true when at or above the cap', () => {
    const town = buildTown([{ itemId: oreId, maxQuantity: 200 }]);
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { materials: { [oreId]: 200 } } } },
    } as unknown as GameState);

    expect(townMaterialAtOrAboveThreshold(town, oreId)).toBe(true);
  });
});

describe('townGoldThreshold', () => {
  it('resolves the threshold entry keyed by the real Gold Coin item id', () => {
    const town = buildTown([{ itemId: goldCoinItemId, maxQuantity: 25000 }]);

    expect(townGoldThreshold(town)).toBe(25000);
  });

  it('defaults to 0 when no gold threshold is authored', () => {
    const town = buildTown([]);

    expect(townGoldThreshold(town)).toBe(0);
  });
});
