import type * as RecipesHelper from '@helpers/crafting/recipes';
import type * as MaterialsHelper from '@helpers/item/materials';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/kingdom/armory', () => ({
  getArmoryEntries: vi.fn(),
}));

vi.mock('@helpers/caravan/caravan', () => ({
  caravanState: vi.fn(),
}));

vi.mock('@helpers/item/collectibles', () => ({
  getCollectibleQuantity: vi.fn(),
  isCollectibleDiscovered: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/crafting/recipes', async (importOriginal) => ({
  ...(await importOriginal<typeof RecipesHelper>()),
  isRecipeDiscovered: vi.fn(),
  recipeBackdropSprite: vi.fn(),
  recipeResultContent: vi.fn(),
  recipeResultSpritesheet: vi.fn(),
}));

vi.mock('@helpers/item/materials', async (importOriginal) => {
  const actual = await importOriginal<typeof MaterialsHelper>();
  const testGoldCoinId = 'gold-coin' as ItemId;
  const testTraderTokenId = 'trader-token' as ItemId;
  const getGoldQuantity = vi.fn();
  return {
    ...actual,
    getMaterialQuantity: vi.fn(),
    getGoldQuantity,
    goldCoinId: vi.fn(() => testGoldCoinId),
    hasGold: vi.fn((amount: number) => getGoldQuantity() >= amount),
    gainGold: vi.fn((state: GameState, amount: number) =>
      actual.applyMaterialDelta(state, testGoldCoinId, amount),
    ),
    spendGold: vi.fn((state: GameState, amount: number) =>
      actual.applyMaterialDelta(state, testGoldCoinId, -amount),
    ),
    traderTokenId: vi.fn(() => testTraderTokenId),
    hasTraderTokens: vi.fn(),
  };
});

vi.mock('@helpers/hero/party', () => ({
  partyGet: vi.fn(),
  partyAffixEffects: vi.fn(() => []),
}));

vi.mock('@helpers/rng', () => ({
  rngUuid: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeCaravan: vi.fn(),
}));

import {
  caravanIsTradeSoldOut,
  caravanTradeMaxQuantity,
  caravanTradeOwnedQuantity,
  caravanTradePrice,
  caravanTradeRemaining,
} from '@helpers/caravan/caravan-trade-quantity';
import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import { getGoldQuantity, getMaterialQuantity } from '@helpers/item/materials';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import type {
  CaravanContent,
  CaravanId,
  CaravanTrade,
  CollectibleId,
  EquipmentId,
  GameState,
  ItemId,
  RecipeId,
} from '@interfaces';

const caravan: CaravanContent = {
  id: 'carrina-duchy' as CaravanId,
  name: 'Duchy Trading Caravan - Carrina',
  __type: 'caravan',
  description: 'A caravan.',
  traderResetTime: 100,
  level: { min: 1, max: 10 },
  markupPercentages: { sell: 25, buy: -15 },
  traderCategories: ['Carrina'],
  commissionOffers: [],
};

describe('caravanTradePrice', () => {
  it('marks a sell trade up by the caravan sell percentage', () => {
    const trade: CaravanTrade = { type: 'sell', value: 100, weight: 1 };
    expect(caravanTradePrice(caravan, trade)).toBe(125);
  });

  it('marks a buy trade down by the (negative) caravan buy percentage', () => {
    const trade: CaravanTrade = { type: 'buy', value: 100, weight: 1 };
    expect(caravanTradePrice(caravan, trade)).toBe(85);
  });

  it('never returns less than 1 gold', () => {
    const trade: CaravanTrade = { type: 'buy', value: 1, weight: 1 };
    const cheapCaravan = {
      ...caravan,
      markupPercentages: { sell: 0, buy: -99 },
    };
    expect(caravanTradePrice(cheapCaravan, trade)).toBe(1);
  });
});

describe('caravanTradeRemaining', () => {
  it('returns undefined for an unlimited trade', () => {
    const trade: CaravanTrade = { type: 'sell', value: 10, weight: 1 };
    expect(caravanTradeRemaining(trade, {}, 0)).toBeUndefined();
  });

  it('subtracts the count so far from the limit', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 10,
      limit: 5,
      weight: 1,
    };
    expect(caravanTradeRemaining(trade, { 0: 2 }, 0)).toBe(3);
  });

  it('floors at 0', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 10,
      limit: 2,
      weight: 1,
    };
    expect(caravanTradeRemaining(trade, { 0: 5 }, 0)).toBe(0);
  });
});

describe('caravanIsTradeSoldOut', () => {
  beforeEach(() => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
  });

  it('is false for an unlimited trade', () => {
    const trade: CaravanTrade = { type: 'sell', value: 10, weight: 1 };
    expect(caravanIsTradeSoldOut(trade, {}, 0)).toBe(false);
  });

  it('is true once the limit is exhausted', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 10,
      limit: 2,
      weight: 1,
    };
    expect(caravanIsTradeSoldOut(trade, { 0: 2 }, 0)).toBe(true);
  });

  it('is false while stock remains', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 10,
      limit: 2,
      weight: 1,
    };
    expect(caravanIsTradeSoldOut(trade, { 0: 1 }, 0)).toBe(false);
  });

  it('is always sold out for an already-owned collectible, even with no limit', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 1000,
      collectibleId: 'trinket' as CollectibleId,
      weight: 1,
    };
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);

    expect(caravanIsTradeSoldOut(trade, {}, 0)).toBe(true);
  });

  it('is not sold out for a not-yet-owned collectible', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 1000,
      collectibleId: 'trinket' as CollectibleId,
      weight: 1,
    };
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);

    expect(caravanIsTradeSoldOut(trade, {}, 0)).toBe(false);
  });

  it('is always sold out for an already-discovered recipe, even with no limit', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 25000,
      recipeId: 'recipe-a' as RecipeId,
      weight: 1,
    };
    vi.mocked(isRecipeDiscovered).mockReturnValue(true);

    expect(caravanIsTradeSoldOut(trade, {}, 0)).toBe(true);
  });

  it('is not sold out for a not-yet-discovered recipe', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 25000,
      recipeId: 'recipe-a' as RecipeId,
      weight: 1,
    };
    vi.mocked(isRecipeDiscovered).mockReturnValue(false);

    expect(caravanIsTradeSoldOut(trade, {}, 0)).toBe(false);
  });
});

describe('caravanTradeOwnedQuantity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves owned quantity for an item trade', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(7);

    expect(
      caravanTradeOwnedQuantity({
        type: 'buy',
        value: 1,
        itemId: 'ore' as ItemId,
        weight: 1,
      }),
    ).toBe(7);
  });

  it('counts matching armory entries for an equipment trade', () => {
    vi.mocked(getArmoryEntries).mockReturnValue([
      { content: { id: 'sword' as EquipmentId } } as never,
      { content: { id: 'shield' as EquipmentId } } as never,
      { content: { id: 'sword' as EquipmentId } } as never,
    ]);

    expect(
      caravanTradeOwnedQuantity({
        type: 'buy',
        value: 1,
        equipmentId: 'sword' as EquipmentId,
        weight: 1,
      }),
    ).toBe(2);
  });

  it('resolves owned quantity for a collectible trade', () => {
    vi.mocked(getCollectibleQuantity).mockReturnValue(1);

    expect(
      caravanTradeOwnedQuantity({
        type: 'sell',
        value: 1,
        collectibleId: 'trinket' as CollectibleId,
        weight: 1,
      }),
    ).toBe(1);
  });

  it('resolves owned quantity for a recipe trade', () => {
    vi.mocked(isRecipeDiscovered).mockReturnValue(true);

    expect(
      caravanTradeOwnedQuantity({
        type: 'sell',
        value: 1,
        recipeId: 'recipe-a' as RecipeId,
        weight: 1,
      }),
    ).toBe(1);
  });

  it('returns 0 for an undiscovered recipe trade', () => {
    vi.mocked(isRecipeDiscovered).mockReturnValue(false);

    expect(
      caravanTradeOwnedQuantity({
        type: 'sell',
        value: 1,
        recipeId: 'recipe-a' as RecipeId,
        weight: 1,
      }),
    ).toBe(0);
  });

  it('returns 0 for a trade with no target id', () => {
    expect(
      caravanTradeOwnedQuantity({ type: 'sell', value: 1, weight: 1 }),
    ).toBe(0);
  });
});

describe('caravanTradeMaxQuantity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
  });

  it('caps a sell trade by what the party can afford, when unlimited', () => {
    const trade: CaravanTrade = { type: 'sell', value: 100, weight: 1 }; // price 125
    vi.mocked(getGoldQuantity).mockReturnValue(310);

    expect(caravanTradeMaxQuantity(caravan, trade, {}, 0)).toBe(2);
  });

  it('caps a sell trade by remaining stock when it is lower than affordable', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 100,
      limit: 1,
      weight: 1,
    };
    vi.mocked(getGoldQuantity).mockReturnValue(10000);

    expect(caravanTradeMaxQuantity(caravan, trade, {}, 0)).toBe(1);
  });

  it('is 0 for a sell trade the party cannot afford at all', () => {
    const trade: CaravanTrade = { type: 'sell', value: 100, weight: 1 };
    vi.mocked(getGoldQuantity).mockReturnValue(0);

    expect(caravanTradeMaxQuantity(caravan, trade, {}, 0)).toBe(0);
  });

  it('caps a buy trade by owned quantity, when unlimited', () => {
    const trade: CaravanTrade = {
      type: 'buy',
      value: 10,
      itemId: 'ore' as ItemId,
      weight: 1,
    };
    vi.mocked(getMaterialQuantity).mockReturnValue(5);

    expect(caravanTradeMaxQuantity(caravan, trade, {}, 0)).toBe(5);
  });

  it('caps a buy trade by remaining stock when it is lower than owned', () => {
    const trade: CaravanTrade = {
      type: 'buy',
      value: 10,
      itemId: 'ore' as ItemId,
      limit: 2,
      weight: 1,
    };
    vi.mocked(getMaterialQuantity).mockReturnValue(5);

    expect(caravanTradeMaxQuantity(caravan, trade, {}, 0)).toBe(2);
  });

  it('is always at most 1 for an undiscovered collectible, regardless of limit', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 100,
      collectibleId: 'trinket' as CollectibleId,
      weight: 1,
    };

    expect(caravanTradeMaxQuantity(caravan, trade, {}, 0)).toBe(1);
  });

  it('is 0 for an already-discovered collectible', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 100,
      collectibleId: 'trinket' as CollectibleId,
      weight: 1,
    };
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);

    expect(caravanTradeMaxQuantity(caravan, trade, {}, 0)).toBe(0);
  });

  it('is always at most 1 for an undiscovered recipe, regardless of limit or gold', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 25000,
      recipeId: 'recipe-a' as RecipeId,
      weight: 1,
    };
    vi.mocked(isRecipeDiscovered).mockReturnValue(false);

    expect(caravanTradeMaxQuantity(caravan, trade, {}, 0)).toBe(1);
  });

  it('is 0 for an already-discovered recipe', () => {
    const trade: CaravanTrade = {
      type: 'sell',
      value: 25000,
      recipeId: 'recipe-a' as RecipeId,
      weight: 1,
    };
    vi.mocked(isRecipeDiscovered).mockReturnValue(true);

    expect(caravanTradeMaxQuantity(caravan, trade, {}, 0)).toBe(0);
  });
});

