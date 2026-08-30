vi.mock('@helpers/crafting/recipes', () => ({
  isRecipeDiscovered: vi.fn(),
}));

vi.mock('@helpers/hero/party', () => ({
  partyAffixEffects: vi.fn(() => []),
}));

vi.mock('@helpers/item/collectibles', () => ({
  getCollectibleQuantity: vi.fn(),
  isCollectibleDiscovered: vi.fn(),
}));

vi.mock('@helpers/item/materials', () => ({
  getGoldQuantity: vi.fn(),
  getMaterialQuantity: vi.fn(),
  goldCoinId: vi.fn(() => 'gold-coin'),
}));

vi.mock('@helpers/kingdom/armory', () => ({
  getArmoryEntries: vi.fn(() => []),
}));

import { caravanTradePrice } from '@helpers/caravan/caravan-trade-quantity';
import { partyAffixEffects } from '@helpers/hero/party';
import type { AffixEffect, CaravanContent, CaravanTrade } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function buildCaravan(sellMarkup: number, buyMarkup: number): CaravanContent {
  return {
    markupPercentages: { sell: sellMarkup, buy: buyMarkup },
  } as CaravanContent;
}

function buildTrade(type: 'sell' | 'buy', value: number): CaravanTrade {
  return { type, value, weight: 1 };
}

describe('caravanTradePrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(partyAffixEffects).mockReturnValue([]);
  });

  it('marks a sell trade up by the caravan sell percentage', () => {
    const caravan = buildCaravan(50, 0);
    expect(caravanTradePrice(caravan, buildTrade('sell', 100))).toBe(150);
  });

  it('marks a buy trade by the (typically negative) caravan buy percentage', () => {
    const caravan = buildCaravan(0, -50);
    expect(caravanTradePrice(caravan, buildTrade('buy', 100))).toBe(50);
  });

  it('never returns less than 1 gold', () => {
    const caravan = buildCaravan(0, -100);
    expect(caravanTradePrice(caravan, buildTrade('buy', 100))).toBe(1);
  });

  it('reduces a sell price by the party-wide CaravanBuyDiscount affix bonus', () => {
    const caravan = buildCaravan(0, 0);
    vi.mocked(partyAffixEffects).mockReturnValue([
      { kind: 'CaravanBuyDiscount', value: 20 },
    ] as AffixEffect[]);

    expect(caravanTradePrice(caravan, buildTrade('sell', 100))).toBe(80);
  });

  it('increases a buy price by the party-wide CaravanSellBonus affix bonus', () => {
    const caravan = buildCaravan(0, 0);
    vi.mocked(partyAffixEffects).mockReturnValue([
      { kind: 'CaravanSellBonus', value: 20 },
    ] as AffixEffect[]);

    expect(caravanTradePrice(caravan, buildTrade('buy', 100))).toBe(120);
  });

  it('only applies the affix matching the trade direction', () => {
    const caravan = buildCaravan(0, 0);
    vi.mocked(partyAffixEffects).mockReturnValue([
      { kind: 'CaravanSellBonus', value: 20 },
      { kind: 'CaravanBuyDiscount', value: 20 },
    ] as AffixEffect[]);

    expect(caravanTradePrice(caravan, buildTrade('sell', 100))).toBe(80);
    expect(caravanTradePrice(caravan, buildTrade('buy', 100))).toBe(120);
  });
});
