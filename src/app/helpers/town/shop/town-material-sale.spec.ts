import { describe, expect, it } from 'vitest';

import { ensureTown } from '@helpers/content/ensure-town';
import {
  townMaterialSaleAvailable,
  townMaterialSaleConfig,
  townMaterialSaleMaxQuantity,
  townMaterialSalePrice,
} from '@helpers/town/shop/town-material-sale';
import type {
  ItemId,
  TownContent,
  TownId,
  TownMaterialThreshold,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const oreId = 'copper-ore' as ItemId;

function buildTown(
  thresholds: Partial<TownMaterialThreshold>[] = [],
  sellMarkup = 0,
): TownContent {
  return ensureTown({
    id: townId,
    materialThresholds: thresholds.map((threshold) => ({
      itemId: oreId,
      ...threshold,
    })) as TownContent['materialThresholds'],
    traders: {
      markupPercentages: { sell: sellMarkup, buy: 0 },
    } as TownContent['traders'],
  });
}

function threshold(
  overrides: Partial<TownMaterialThreshold>,
): TownMaterialThreshold {
  return buildTown([overrides]).materialThresholds[0];
}

function seedCoffers(quantity: number): void {
  seedGamestate((state) => {
    state.world.towns[townId] = buildTownNodeState({
      materials: { [oreId]: quantity },
    });
  });
}

describe('townMaterialSaleConfig', () => {
  it('only returns an entry for this item that opts into sale with a value', () => {
    expect(
      townMaterialSaleConfig(buildTown([{ value: 10 }]), oreId)?.itemId,
    ).toBe(oreId);
    expect(
      townMaterialSaleConfig(buildTown([{ value: 0 }]), oreId),
    ).toBeUndefined();
    expect(
      townMaterialSaleConfig(
        buildTown([{ itemId: 'other' as ItemId, value: 10 }]),
        oreId,
      ),
    ).toBeUndefined();
  });
});

describe('townMaterialSalePrice', () => {
  it('marks the value up by the traders sell markup, rounded', () => {
    expect(
      townMaterialSalePrice(buildTown([], 25), threshold({ value: 100 })),
    ).toBe(125);
    expect(
      townMaterialSalePrice(buildTown([], 10), threshold({ value: 15 })),
    ).toBe(17);
  });

  it('never prices below 1 gold', () => {
    expect(
      townMaterialSalePrice(buildTown([], -100), threshold({ value: 5 })),
    ).toBe(1);
  });
});

describe('townMaterialSaleAvailable', () => {
  it('is the coffer quantity above sellAtQuantity, never negative', () => {
    const sale = threshold({ sellAtQuantity: 200 });

    seedCoffers(250);
    expect(townMaterialSaleAvailable(buildTown(), sale)).toBe(50);

    seedCoffers(100);
    expect(townMaterialSaleAvailable(buildTown(), sale)).toBe(0);
  });
});

describe('townMaterialSaleMaxQuantity', () => {
  it('is capped by both the coffer excess and the gold on hand', () => {
    const sale = threshold({ value: 10, sellAtQuantity: 200 });
    seedCoffers(250);

    expect(townMaterialSaleMaxQuantity(buildTown(), sale, 1_000_000)).toBe(50);
    expect(townMaterialSaleMaxQuantity(buildTown(), sale, 25)).toBe(2);
  });
});
