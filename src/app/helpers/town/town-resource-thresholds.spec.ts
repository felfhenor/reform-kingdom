import { beforeEach, describe, expect, it } from 'vitest';

import { ensureItem } from '@helpers/content/ensure-item';
import {
  ensureTown,
  ensureTownMaterialThreshold,
} from '@helpers/content/ensure-town';
import {
  townGoldThreshold,
  townMaterialAtOrAboveThreshold,
  townMaterialThreshold,
} from '@helpers/town/town-resource-thresholds';
import type {
  ItemId,
  TownContent,
  TownId,
  TownMaterialThreshold,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const oreId = 'copper-ore' as ItemId;
const gold = ensureItem({ id: 'gold' as ItemId, name: 'Gold Coin' });

function town(
  thresholds: Partial<TownMaterialThreshold>[],
  id = 'larsia',
): TownContent {
  return ensureTown({
    id: id as TownId,
    name: id,
    materialThresholds: thresholds.map(ensureTownMaterialThreshold),
  });
}

function seedOre(content: TownContent, ore: number): void {
  seedGamestate((state) => {
    state.world.towns[content.id] = buildTownNodeState({
      materials: { [oreId]: ore },
    });
  });
}

beforeEach(() => {
  seedContent([gold]);
});

describe('townMaterialThreshold', () => {
  it('reads each town’s own cap, leaving items without one uncapped', () => {
    const capped = town([{ itemId: oreId, maxQuantity: 200 }]);
    const uncapped = town([], 'elsewhere');

    expect(townMaterialThreshold(capped, oreId)).toBe(200);
    expect(townMaterialThreshold(uncapped, oreId)).toBeUndefined();
  });
});

describe('townMaterialAtOrAboveThreshold', () => {
  it('is reached at the cap, and never for an uncapped item', () => {
    const capped = town([{ itemId: oreId, maxQuantity: 200 }]);

    seedOre(capped, 199);
    expect(townMaterialAtOrAboveThreshold(capped, oreId)).toBe(false);

    seedOre(capped, 200);
    expect(townMaterialAtOrAboveThreshold(capped, oreId)).toBe(true);

    const uncapped = town([]);
    seedOre(uncapped, 99_999);
    expect(townMaterialAtOrAboveThreshold(uncapped, oreId)).toBe(false);
  });
});

describe('townGoldThreshold', () => {
  it('is the Gold Coin cap, or 0 when the town has none', () => {
    expect(
      townGoldThreshold(town([{ itemId: gold.id, maxQuantity: 25_000 }])),
    ).toBe(25_000);
    expect(townGoldThreshold(town([]))).toBe(0);
  });
});
