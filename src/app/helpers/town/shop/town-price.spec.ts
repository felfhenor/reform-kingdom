import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/kingdom/armory', () => ({
  equipmentSellValue: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { equipmentSellValue } from '@helpers/kingdom/armory';
import { townStockPrice } from '@helpers/town/shop/town-price';
import type {
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
  TownContent,
  TownStockEntry,
} from '@interfaces';

function buildTown(sellMarkup: number): TownContent {
  return {
    traders: { sellItemCount: 10, markupPercentages: { sell: sellMarkup, buy: 0 } },
  } as unknown as TownContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townStockPrice', () => {
  it('prices an item entry from its rarity, marked up', () => {
    vi.mocked(getEntry).mockReturnValue({
      rarity: 'Rare',
    } as ItemContent);
    const entry: TownStockEntry = {
      itemId: 'ore' as ItemId,
      quantity: 1,
    };

    expect(townStockPrice(buildTown(25), entry)).toBe(50);
  });

  it('prices an equipment entry via the shared equipmentSellValue formula, marked up', () => {
    vi.mocked(getEntry).mockReturnValue({} as EquipmentContent);
    vi.mocked(equipmentSellValue).mockReturnValue(100);
    const entry: TownStockEntry = {
      equipmentItem: { equipmentId: 'sword' as EquipmentId } as never,
    };

    expect(townStockPrice(buildTown(25), entry)).toBe(125);
  });

  it('returns undefined when the item content no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const entry: TownStockEntry = { itemId: 'removed' as ItemId, quantity: 1 };

    expect(townStockPrice(buildTown(0), entry)).toBeUndefined();
  });

  it('returns undefined when the equipment content no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const entry: TownStockEntry = {
      equipmentItem: { equipmentId: 'removed' as EquipmentId } as never,
    };

    expect(townStockPrice(buildTown(0), entry)).toBeUndefined();
  });

  it('never prices below 1 gold', () => {
    vi.mocked(getEntry).mockReturnValue({ rarity: 'Common' } as ItemContent);
    const entry: TownStockEntry = { itemId: 'ore' as ItemId, quantity: 1 };

    expect(townStockPrice(buildTown(-100), entry)).toBe(1);
  });
});
