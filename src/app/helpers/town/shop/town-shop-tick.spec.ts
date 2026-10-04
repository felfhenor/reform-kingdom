import { describe, expect, it } from 'vitest';

import { ensureTown } from '@helpers/content/ensure-town';
import { worldTownsState } from '@helpers/state-game';
import { townShopProcessTick } from '@helpers/town/shop/town-shop-tick';
import type { EquipmentId, TownId, TownNodeState } from '@interfaces';
import { buildTownNodeState, buildTownStockEntry } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const now = 500;
const town = (itemExpirationTimer: number) =>
  ensureTown({
    id: 'larsia' as TownId,
    name: 'Larsia',
    traders: { itemExpirationTimer },
  });

// One entry per age, named by how many ticks old it is.
function seedStock(
  expirationTimer: number,
  ages: number[],
  townState: Partial<TownNodeState> = {},
): void {
  const content = town(expirationTimer);
  seedContent([content]);
  seedGamestate((state) => {
    state.clock.numTicks = now;
    state.world.towns[content.id] = buildTownNodeState({
      ...townState,
      stock: ages.map((age) =>
        buildTownStockEntry(`aged-${age}` as EquipmentId, now - age),
      ),
    });
  });
}

const stockAges = () =>
  worldTownsState()['larsia' as TownId].stock.map((entry) =>
    Number(entry.equipmentItem.equipmentId.replace('aged-', '')),
  );

describe('townShopProcessTick', () => {
  it('expires stock once it reaches the town’s expiration age', () => {
    seedStock(100, [50, 99, 100, 200]);

    inTick(() => townShopProcessTick());

    expect(stockAges()).toEqual([50, 99]);
  });

  it('keeps stock forever in a town with expiration turned off', () => {
    seedStock(0, [50, 10_000]);

    inTick(() => townShopProcessTick());

    expect(stockAges()).toEqual([50, 10_000]);
  });

  it('waits until the town is due for a shop update', () => {
    seedStock(100, [200], { lastProcessedTick: { shop: now } });

    inTick(() => townShopProcessTick());

    expect(stockAges()).toEqual([200]);
  });
});
