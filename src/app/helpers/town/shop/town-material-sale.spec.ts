import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { gamestate } from '@helpers/state-game';
import {
  townMaterialSaleAvailable,
  townMaterialSaleConfig,
  townMaterialSaleMaxQuantity,
  townMaterialSalePrice,
} from '@helpers/town/shop/town-material-sale';
import type { GameState, ItemId, TownContent, TownId } from '@interfaces';

const townId = 'larsia' as TownId;
const oreId = 'copper-ore' as ItemId;

function buildTown(
  thresholds: Partial<{
    itemId: ItemId;
    maxQuantity: number;
    value: number;
    sellAtQuantity: number;
  }>[],
  sellMarkup = 0,
): TownContent {
  return {
    id: townId,
    materialThresholds: thresholds.map((threshold) => ({
      itemId: oreId,
      maxQuantity: 0,
      value: 0,
      sellAtQuantity: 0,
      ...threshold,
    })),
    traders: { markupPercentages: { sell: sellMarkup, buy: 0 } },
  } as unknown as TownContent;
}

function mockTownMaterials(quantity: number): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { towns: { [townId]: { materials: { [oreId]: quantity } } } },
  } as unknown as GameState);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townMaterialSaleConfig', () => {
  it('returns the entry when value opts it into sale', () => {
    const town = buildTown([{ value: 10 }]);

    expect(townMaterialSaleConfig(town, oreId)?.itemId).toBe(oreId);
  });

  it('is undefined when the entry has no value (not opted in)', () => {
    const town = buildTown([{ value: 0 }]);

    expect(townMaterialSaleConfig(town, oreId)).toBeUndefined();
  });

  it('is undefined when there is no entry for the item at all', () => {
    const town = buildTown([]);

    expect(townMaterialSaleConfig(town, oreId)).toBeUndefined();
  });
});

describe('townMaterialSalePrice', () => {
  it('marks the base value up by the traders sell markup', () => {
    const town = buildTown([], 25);

    expect(townMaterialSalePrice(town, { value: 100 } as never)).toBe(125);
  });

  it('rounds the marked-up price', () => {
    const town = buildTown([], 10);

    expect(townMaterialSalePrice(town, { value: 15 } as never)).toBe(17);
  });

  it('never prices below 1 gold', () => {
    const town = buildTown([], -100);

    expect(townMaterialSalePrice(town, { value: 5 } as never)).toBe(1);
  });
});

describe('townMaterialSaleAvailable', () => {
  it('is the coffer quantity above sellAtQuantity', () => {
    const town = buildTown([]);
    mockTownMaterials(250);

    expect(
      townMaterialSaleAvailable(town, {
        itemId: oreId,
        sellAtQuantity: 200,
      } as never),
    ).toBe(50);
  });

  it('clamps at 0 when coffers are below sellAtQuantity', () => {
    const town = buildTown([]);
    mockTownMaterials(100);

    expect(
      townMaterialSaleAvailable(town, {
        itemId: oreId,
        sellAtQuantity: 200,
      } as never),
    ).toBe(0);
  });
});

describe('townMaterialSaleMaxQuantity', () => {
  it('is capped by available coffer excess', () => {
    const town = buildTown([], 0);
    mockTownMaterials(250);

    const threshold = {
      itemId: oreId,
      value: 10,
      sellAtQuantity: 200,
    } as never;
    expect(townMaterialSaleMaxQuantity(town, threshold, 1_000_000)).toBe(50);
  });

  it('is capped by how much gold the player has', () => {
    const town = buildTown([], 0);
    mockTownMaterials(250);

    const threshold = {
      itemId: oreId,
      value: 10,
      sellAtQuantity: 200,
    } as never;
    expect(townMaterialSaleMaxQuantity(town, threshold, 25)).toBe(2);
  });
});
