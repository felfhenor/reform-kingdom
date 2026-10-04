import { describe, expect, it } from 'vitest';

import { ensureEquipment } from '@helpers/content/ensure-item';
import { ensureTown } from '@helpers/content/ensure-town';
import { defaultStats } from '@helpers/defaults';
import { equipmentSellValue } from '@helpers/kingdom/armory';
import { townStockPrice } from '@helpers/town/shop/town-price';
import type { EquipmentId, TownId } from '@interfaces';
import { buildTownStockEntry } from '@/testing/builders';
import { seedContent } from '@/testing/content';

const sword = ensureEquipment({
  id: 'sword' as EquipmentId,
  name: 'Sword',
  baseStats: { ...defaultStats(), Strength: 40 },
});
const townWithMarkup = (sell: number) =>
  ensureTown({
    id: 'larsia' as TownId,
    traders: { markupPercentages: { sell, buy: 0 } },
  });

describe('townStockPrice', () => {
  it('marks up the item’s sell value by the town’s sell markup, never below 1 gold', () => {
    seedContent([sword]);
    const entry = buildTownStockEntry(sword.id);
    const value = equipmentSellValue({
      item: entry.equipmentItem,
      content: sword,
    });

    expect(townStockPrice(townWithMarkup(25), entry)).toBe(
      Math.round(value * 1.25),
    );
    expect(townStockPrice(townWithMarkup(-100), entry)).toBe(1);
  });

  it('has no price for stock whose content is gone', () => {
    seedContent([]);

    expect(
      townStockPrice(townWithMarkup(0), buildTownStockEntry(sword.id)),
    ).toBeUndefined();
  });
});
