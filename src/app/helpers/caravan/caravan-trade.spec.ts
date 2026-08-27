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

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/crafting/recipes', () => ({
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

import { caravanState } from '@helpers/caravan/caravan';
import {
  caravanExecuteTokenTrade,
  caravanExecuteTrade,
} from '@helpers/caravan/caravan-trade';
import {
  caravanTokenTradeDisplay,
  caravanTradeDisplay,
} from '@helpers/caravan/caravan-trade-display';
import {
  caravanIsTradeSoldOut,
  caravanTradeMaxQuantity,
  caravanTradeOwnedQuantity,
  caravanTradePrice,
  caravanTradeRemaining,
} from '@helpers/caravan/caravan-trade-quantity';
import { getEntry } from '@helpers/content';
import {
  isRecipeDiscovered,
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import { partyGet } from '@helpers/hero/party';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import {
  getGoldQuantity,
  getMaterialQuantity,
  hasTraderTokens,
} from '@helpers/item/materials';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import { rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CaravanNodeState,
  CaravanTokenTrade,
  CaravanTrade,
  CaravanTraderContent,
  CaravanTraderId,
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  GameState,
  ItemContent,
  ItemId,
  RecipeContent,
  RecipeId,
  WorldNodeEntry,
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

describe('caravanTradeDisplay', () => {
  it('resolves an item trade', () => {
    const item: ItemContent = {
      id: 'ore' as ItemId,
      name: 'Copper Ore',
      __type: 'item',
      description: 'Shiny.',
      sprite: '0001',
      rarity: 'Common',
    };
    vi.mocked(getEntry).mockReturnValue(item);

    expect(
      caravanTradeDisplay({
        type: 'sell',
        value: 1,
        itemId: item.id,
        weight: 1,
      }),
    ).toEqual({
      name: 'Copper Ore',
      description: 'Shiny.',
      sprite: '0001',
      spritesheet: 'item',
      rarity: 'Common',
    });
  });

  it('resolves an equipment trade, including its base stats and level requirement', () => {
    const equipment = {
      id: 'sword' as EquipmentId,
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      rarity: 'Rare',
      levelRequirement: 4,
      baseStats: { Strength: 5 },
    } as EquipmentContent;
    vi.mocked(getEntry).mockReturnValue(equipment);
    vi.mocked(partyGet).mockReturnValue([]);

    expect(
      caravanTradeDisplay({
        type: 'sell',
        value: 1,
        equipmentId: equipment.id,
        weight: 1,
      }),
    ).toEqual({
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      spritesheet: 'equipment',
      rarity: 'Rare',
      levelRequirement: 4,
      stats: { Strength: 5 },
      equippableHeroNames: [],
    });
  });

  it('resolves a collectible trade', () => {
    const collectible = {
      id: 'trinket' as CollectibleId,
      name: 'Trinket',
      description: 'Curious.',
      sprite: '0003',
      rarity: 'Legendary',
    } as CollectibleContent;
    vi.mocked(getEntry).mockReturnValue(collectible);

    expect(
      caravanTradeDisplay({
        type: 'sell',
        value: 1,
        collectibleId: collectible.id,
        weight: 1,
      })?.spritesheet,
    ).toBe('collectible');
  });

  it('returns undefined when the trade has no target id', () => {
    expect(
      caravanTradeDisplay({ type: 'sell', value: 1, weight: 1 }),
    ).toBeUndefined();
  });

  it('returns undefined when the referenced content no longer exists', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(
      caravanTradeDisplay({
        type: 'sell',
        value: 1,
        itemId: 'gone' as ItemId,
        weight: 1,
      }),
    ).toBeUndefined();
  });

  it('resolves a recipe trade using the recipe name and its result icon/description', () => {
    const recipe: RecipeContent = {
      id: 'recipe-a' as RecipeId,
      name: 'Equipment: Ghostcopper Gear',
      __type: 'recipe',
      result: { equipmentId: 'ghostcopper-gear' as EquipmentId },
      requirements: [],
      tradeskillId: 'artificing-id' as never,
      minTradeskillLevel: 10,
      maxTradeskillLevel: 10,
      tradeskillXP: 1,
      craftTime: 60,
      tokenUnlockCost: 3,
    };
    const equipment = {
      id: 'ghostcopper-gear' as EquipmentId,
      name: 'Ghostcopper Gear',
      description: 'A copper gear, enhanced with ghostcopper dust.',
      sprite: '0116',
      rarity: 'Rare',
      levelRequirement: 20,
      baseStats: { Resistance: 4.5, Vitality: 4.5 },
    } as EquipmentContent;

    vi.mocked(getEntry).mockReturnValue(recipe);
    vi.mocked(recipeResultContent).mockReturnValue(equipment);
    vi.mocked(recipeResultSpritesheet).mockReturnValue('equipment');
    vi.mocked(recipeBackdropSprite).mockReturnValue('recipe-backdrop');
    vi.mocked(partyGet).mockReturnValue([]);

    expect(
      caravanTradeDisplay({
        type: 'sell',
        value: 25000,
        recipeId: recipe.id,
        weight: 1,
      }),
    ).toEqual({
      name: 'Equipment: Ghostcopper Gear',
      description: 'A copper gear, enhanced with ghostcopper dust.',
      sprite: '0116',
      spritesheet: 'equipment',
      rarity: 'Rare',
      levelRequirement: 20,
      stats: { Resistance: 4.5, Vitality: 4.5 },
      equippableHeroNames: [],
      backdropSprite: 'recipe-backdrop',
    });
  });

  it('returns undefined for a recipe trade whose recipe no longer exists', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(
      caravanTradeDisplay({
        type: 'sell',
        value: 25000,
        recipeId: 'gone' as RecipeId,
        weight: 1,
      }),
    ).toBeUndefined();
  });
});

describe('caravanExecuteTrade', () => {
  const entry = {
    nodeName: 'Duchy Trading Caravan - Carrina',
  } as WorldNodeEntry;
  const trader: CaravanTraderContent = {
    id: 'trader-a' as CaravanTraderId,
    name: 'Trader A',
    __type: 'caravantrader',
    description: 'A trader.',
    category: 'Carrina',
    level: 5,
    trades: [
      {
        type: 'sell',
        value: 100,
        itemId: 'ore' as ItemId,
        limit: 2,
        weight: 1,
      },
      { type: 'buy', value: 50, itemId: 'ore' as ItemId, weight: 1 },
      {
        type: 'sell',
        value: 1000,
        collectibleId: 'trinket' as CollectibleId,
        weight: 1,
      },
      {
        type: 'sell',
        value: 25000,
        recipeId: 'recipe-a' as RecipeId,
        limit: 1,
        weight: 1,
      },
    ],
    tokenTrades: [],
  };

  function nodeState(
    overrides: Partial<CaravanNodeState> = {},
  ): CaravanNodeState {
    return {
      traderId: trader.id,
      activeTradeIndices: [0, 1],
      tradeCounts: {},
      generatedAtTick: 1000,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(worldNodeCaravan).mockReturnValue(caravan);
    vi.mocked(getEntry).mockReturnValue(trader);
    vi.mocked(rngUuid).mockReturnValue('new-item-id');
  });

  it('returns false when the node is not a caravan', async () => {
    vi.mocked(worldNodeCaravan).mockReturnValue(undefined);

    expect(await caravanExecuteTrade(entry, 0)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false when no trader is currently assigned', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState({ traderId: undefined }));

    expect(await caravanExecuteTrade(entry, 0)).toBe(false);
  });

  it('returns false for a trade index that is not currently active', async () => {
    vi.mocked(caravanState).mockReturnValue(
      nodeState({ activeTradeIndices: [1] }),
    );

    expect(await caravanExecuteTrade(entry, 0)).toBe(false);
  });

  it('returns false once the trade is sold out', async () => {
    vi.mocked(caravanState).mockReturnValue(
      nodeState({ tradeCounts: { 0: 2 } }),
    );

    expect(await caravanExecuteTrade(entry, 0)).toBe(false);
  });

  it('returns false when the party cannot afford a sell trade', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getGoldQuantity).mockReturnValue(0);

    expect(await caravanExecuteTrade(entry, 0)).toBe(false);
  });

  it('grants the item and deducts gold on a successful sell trade', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getGoldQuantity).mockReturnValue(1000);

    // updateGamestate is a dumb recorder here (it doesn't invoke the
    // callback itself), so the callback is captured and run manually before
    // awaiting the outer promise - mirroring the double-fire regression test
    // further down, which relies on the same capture-then-invoke shape.
    const resultPromise = caravanExecuteTrade(entry, 0);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: { ['gold-coin' as ItemId]: { quantity: 1000, foundAt: 1 } },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      world: { caravans: { [caravan.id]: nodeState() } },
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
    expect(result.materials['ore' as ItemId].quantity).toBe(1);
    expect(result.materials['gold-coin' as ItemId].quantity).toBe(875);
    expect(result.world.caravans[caravan.id].tradeCounts[0]).toBe(1);
  });

  it('takes the item and credits gold on a successful buy trade', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getMaterialQuantity).mockReturnValue(3);

    const resultPromise = caravanExecuteTrade(entry, 1);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: { ['ore' as ItemId]: { quantity: 3, foundAt: 1 } },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      world: { caravans: { [caravan.id]: nodeState() } },
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
    expect(result.materials['ore' as ItemId].quantity).toBe(2);
    expect(result.materials['gold-coin' as ItemId].quantity).toBe(43);
    expect(result.world.caravans[caravan.id].tradeCounts[1]).toBe(1);
  });

  it('succeeds a buy trade even when the party currently has no gold', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getMaterialQuantity).mockReturnValue(3);
    vi.mocked(getGoldQuantity).mockReturnValue(0);

    const resultPromise = caravanExecuteTrade(entry, 1);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    updateFn({
      materials: { ['ore' as ItemId]: { quantity: 3, foundAt: 1 } },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      world: { caravans: { [caravan.id]: nodeState() } },
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
  });

  it('blocks buying an undiscovered collectible the party cannot afford, even though max quantity ignores gold', async () => {
    vi.mocked(caravanState).mockReturnValue(
      nodeState({ activeTradeIndices: [0, 1, 2] }),
    );
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
    vi.mocked(getGoldQuantity).mockReturnValue(0);

    expect(await caravanExecuteTrade(entry, 2)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false for a quantity of 0 or less', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getGoldQuantity).mockReturnValue(1000);

    expect(await caravanExecuteTrade(entry, 0, 0)).toBe(false);
    expect(await caravanExecuteTrade(entry, 0, -1)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false when the requested quantity exceeds what is available', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    // Trade 0 has limit 2 and none bought yet - only 2 are available.
    vi.mocked(getGoldQuantity).mockReturnValue(1_000_000);

    expect(await caravanExecuteTrade(entry, 0, 3)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('buys multiple units in a single atomic commit', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getGoldQuantity).mockReturnValue(1_000_000);

    const resultPromise = caravanExecuteTrade(entry, 0, 2);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: {
        ['gold-coin' as ItemId]: { quantity: 1_000_000, foundAt: 1 },
      },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      world: { caravans: { [caravan.id]: nodeState() } },
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
    // price 125 (100 marked up 25%) x2 = 250
    expect(result.materials['ore' as ItemId].quantity).toBe(2);
    expect(result.materials['gold-coin' as ItemId].quantity).toBe(999_750);
    expect(result.world.caravans[caravan.id].tradeCounts[0]).toBe(2);
  });

  it('sells multiple units in a single atomic commit', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getMaterialQuantity).mockReturnValue(5);

    const resultPromise = caravanExecuteTrade(entry, 1, 3);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: { ['ore' as ItemId]: { quantity: 5, foundAt: 1 } },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      world: { caravans: { [caravan.id]: nodeState() } },
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
    // price 43 (50 marked down 15%, rounded) x3 = 129
    expect(result.materials['ore' as ItemId].quantity).toBe(2);
    expect(result.materials['gold-coin' as ItemId].quantity).toBe(129);
    expect(result.world.caravans[caravan.id].tradeCounts[1]).toBe(3);
  });

  it('does not oversell stock when two purchases race before either commits', async () => {
    // Regression test for the rapid-click double-fire bug: updateGamestate
    // doesn't commit until an async yield later, so the outer max-quantity
    // check (run synchronously before that yield) can pass twice against
    // the same stale, pre-commit tradeCounts if two calls race in before
    // the first one's callback actually runs.
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getGoldQuantity).mockReturnValue(1_000_000);

    const call1 = caravanExecuteTrade(entry, 0, 2);
    const call2 = caravanExecuteTrade(entry, 0, 2);

    expect(updateGamestate).toHaveBeenCalledTimes(2);
    const [updateFn1, updateFn2] = vi
      .mocked(updateGamestate)
      .mock.calls.map((call) => call[0]);

    const initialState = {
      materials: {
        ['gold-coin' as ItemId]: { quantity: 1_000_000, foundAt: 1 },
      },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      world: { caravans: { [caravan.id]: nodeState() } },
    } as unknown as GameState;

    // Simulates commit ordering: call1's callback commits first; call2's
    // callback then runs against that already-committed result, as it would
    // once its own updateGamestate yield resolves.
    const afterFirst = updateFn1(initialState);
    const afterSecond = updateFn2(afterFirst);

    const [result1, result2] = await Promise.all([call1, call2]);

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(afterSecond).toBe(afterFirst);
    // Trade 0's limit is 2 - only call1's purchase should have gone through.
    expect(afterFirst.materials['ore' as ItemId].quantity).toBe(2);
    expect(afterFirst.world.caravans[caravan.id].tradeCounts[0]).toBe(2);
  });

  it('discovers the recipe and deducts gold on a successful recipe purchase', async () => {
    vi.mocked(caravanState).mockReturnValue(
      nodeState({ activeTradeIndices: [3] }),
    );
    vi.mocked(getGoldQuantity).mockReturnValue(1_000_000);
    vi.mocked(isRecipeDiscovered).mockReturnValue(false);

    const resultPromise = caravanExecuteTrade(entry, 3);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: {
        ['gold-coin' as ItemId]: { quantity: 1_000_000, foundAt: 1 },
      },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      world: {
        caravans: { [caravan.id]: nodeState({ activeTradeIndices: [3] }) },
      },
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
    expect(
      result.discoveredRecipes['recipe-a' as RecipeId].foundAt,
    ).toBeGreaterThan(0);
    // price 25000 marked up 25% = 31250
    expect(result.materials['gold-coin' as ItemId].quantity).toBe(968_750);
  });

  it('blocks re-purchasing an already-discovered recipe', async () => {
    vi.mocked(caravanState).mockReturnValue(
      nodeState({ activeTradeIndices: [3] }),
    );
    vi.mocked(getGoldQuantity).mockReturnValue(1_000_000);
    vi.mocked(isRecipeDiscovered).mockReturnValue(true);

    expect(await caravanExecuteTrade(entry, 3)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('caravanTokenTradeDisplay', () => {
  it('resolves a collectible token trade', () => {
    const collectible = {
      id: 'trinket' as CollectibleId,
      name: 'Trinket',
      description: 'Curious.',
      sprite: '0003',
      rarity: 'Legendary',
    } as CollectibleContent;
    vi.mocked(getEntry).mockReturnValue(collectible);

    expect(
      caravanTokenTradeDisplay({
        tokenCost: 3,
        collectibleId: collectible.id,
      })?.spritesheet,
    ).toBe('collectible');
  });

  it('returns undefined when the trade has no target id', () => {
    expect(caravanTokenTradeDisplay({ tokenCost: 3 })).toBeUndefined();
  });
});

describe('caravanExecuteTokenTrade', () => {
  const entry = {
    nodeName: 'Duchy Trading Caravan - Carrina',
  } as WorldNodeEntry;

  const tokenTrade: CaravanTokenTrade = {
    tokenCost: 3,
    collectibleId: 'trinket' as CollectibleId,
  };
  const itemTokenTrade: CaravanTokenTrade = {
    tokenCost: 2,
    itemId: 'ore' as ItemId,
  };
  const equipmentTokenTrade: CaravanTokenTrade = {
    tokenCost: 5,
    equipmentId: 'sword' as EquipmentId,
  };
  const recipeTokenTrade: CaravanTokenTrade = {
    tokenCost: 4,
    recipeId: 'recipe-a' as RecipeId,
  };

  const trader: CaravanTraderContent = {
    id: 'trader-a' as CaravanTraderId,
    name: 'Trader A',
    __type: 'caravantrader',
    description: 'A trader.',
    category: 'Carrina',
    level: 5,
    trades: [],
    tokenTrades: [
      tokenTrade,
      itemTokenTrade,
      equipmentTokenTrade,
      recipeTokenTrade,
    ],
  };

  function nodeState(
    overrides: Partial<CaravanNodeState> = {},
  ): CaravanNodeState {
    return {
      traderId: trader.id,
      activeTradeIndices: [],
      tradeCounts: {},
      generatedAtTick: 1000,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(worldNodeCaravan).mockReturnValue(caravan);
    vi.mocked(getEntry).mockReturnValue(trader);
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
  });

  it('returns false when the node is not a caravan', async () => {
    vi.mocked(worldNodeCaravan).mockReturnValue(undefined);

    expect(await caravanExecuteTokenTrade(entry, 0)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false when no trader is currently assigned', async () => {
    vi.mocked(caravanState).mockReturnValue(
      nodeState({ traderId: undefined }),
    );

    expect(await caravanExecuteTokenTrade(entry, 0)).toBe(false);
  });

  it('returns false for an out-of-range token trade index', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());

    expect(await caravanExecuteTokenTrade(entry, 5)).toBe(false);
  });

  it('returns false when the collectible is already owned', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
    vi.mocked(hasTraderTokens).mockReturnValue(true);

    expect(await caravanExecuteTokenTrade(entry, 0)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false when the player cannot afford the token cost', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(hasTraderTokens).mockReturnValue(false);

    expect(await caravanExecuteTokenTrade(entry, 0)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('grants the collectible and spends tokens on success', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(hasTraderTokens).mockReturnValue(true);

    const resultPromise = caravanExecuteTokenTrade(entry, 0);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: {
        ['trader-token' as ItemId]: { quantity: 5, foundAt: 1 },
      },
      discoveredMaterials: {},
      collectibles: {},
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
    expect(result.collectibles['trinket' as CollectibleId].quantity).toBe(1);
    expect(result.materials['trader-token' as ItemId].quantity).toBe(2);
  });

  it('grants an item reward and spends tokens on success', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(hasTraderTokens).mockReturnValue(true);

    const resultPromise = caravanExecuteTokenTrade(entry, 1);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: {
        ['trader-token' as ItemId]: { quantity: 5, foundAt: 1 },
      },
      discoveredMaterials: {},
      collectibles: {},
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
    expect(result.materials['ore' as ItemId].quantity).toBe(1);
    expect(result.materials['trader-token' as ItemId].quantity).toBe(3);
  });

  it('grants an equipment reward and spends tokens on success', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(hasTraderTokens).mockReturnValue(true);
    vi.mocked(rngUuid).mockReturnValue('new-equipment-item-id');

    const resultPromise = caravanExecuteTokenTrade(entry, 2);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: {
        ['trader-token' as ItemId]: { quantity: 5, foundAt: 1 },
      },
      discoveredMaterials: {},
      collectibles: {},
      armory: [],
      discoveredEquipment: {},
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
    expect(result.armory).toEqual([
      {
        id: 'new-equipment-item-id',
        equipmentId: 'sword',
        infusedItemIds: [],
      },
    ]);
    expect(result.discoveredEquipment['sword' as EquipmentId].foundAt).toBeGreaterThan(0);
    expect(result.materials['trader-token' as ItemId]).toBeUndefined();
  });

  it('does not double-grant a collectible when two purchases race before either commits', async () => {
    // Regression test for the rapid-click double-fire bug: updateGamestate
    // doesn't commit until an async yield later, so isTokenTradeAlreadyOwned
    // (checked synchronously before that yield) can pass twice against the
    // same stale, pre-commit collectibles state if two calls race in before
    // the first one's callback actually runs.
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(hasTraderTokens).mockReturnValue(true);

    const call1 = caravanExecuteTokenTrade(entry, 0);
    const call2 = caravanExecuteTokenTrade(entry, 0);

    expect(updateGamestate).toHaveBeenCalledTimes(2);
    const [updateFn1, updateFn2] = vi
      .mocked(updateGamestate)
      .mock.calls.map((call) => call[0]);

    const initialState = {
      materials: { ['trader-token' as ItemId]: { quantity: 5, foundAt: 1 } },
      discoveredMaterials: {},
      collectibles: {},
    } as unknown as GameState;

    const afterFirst = updateFn1(initialState);
    const afterSecond = updateFn2(afterFirst);

    const [result1, result2] = await Promise.all([call1, call2]);

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(afterSecond).toBe(afterFirst);
    expect(afterFirst.collectibles['trinket' as CollectibleId].quantity).toBe(
      1,
    );
    expect(afterFirst.materials['trader-token' as ItemId].quantity).toBe(2);
  });

  it('discovers the recipe and spends tokens on a successful recipe token trade', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(hasTraderTokens).mockReturnValue(true);
    vi.mocked(isRecipeDiscovered).mockReturnValue(false);

    const resultPromise = caravanExecuteTokenTrade(entry, 3);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: {
        ['trader-token' as ItemId]: { quantity: 5, foundAt: 1 },
      },
      discoveredMaterials: {},
      collectibles: {},
      discoveredRecipes: {},
    } as unknown as GameState);

    expect(await resultPromise).toBe(true);
    expect(
      result.discoveredRecipes['recipe-a' as RecipeId].foundAt,
    ).toBeGreaterThan(0);
    expect(result.materials['trader-token' as ItemId].quantity).toBe(1);
  });

  it('returns false when the recipe is already discovered', async () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(hasTraderTokens).mockReturnValue(true);
    vi.mocked(isRecipeDiscovered).mockReturnValue(true);

    expect(await caravanExecuteTokenTrade(entry, 3)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});
