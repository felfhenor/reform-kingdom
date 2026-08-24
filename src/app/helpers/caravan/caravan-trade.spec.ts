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

vi.mock('@helpers/item/materials', async (importOriginal) => {
  const actual = await importOriginal<typeof MaterialsHelper>();
  const testGoldCoinId = 'gold-coin' as ItemId;
  const getGoldQuantity = vi.fn();
  return {
    ...actual,
    getMaterialQuantity: vi.fn(),
    getGoldQuantity,
    hasGold: vi.fn((amount: number) => getGoldQuantity() >= amount),
    gainGold: vi.fn((state: GameState, amount: number) =>
      actual.applyMaterialDelta(state, testGoldCoinId, amount),
    ),
    spendGold: vi.fn((state: GameState, amount: number) =>
      actual.applyMaterialDelta(state, testGoldCoinId, -amount),
    ),
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
  caravanExecuteTrade,
  caravanIsTradeSoldOut,
  caravanTradeDisplay,
  caravanTradeMaxQuantity,
  caravanTradeOwnedQuantity,
  caravanTradePrice,
  caravanTradeRemaining,
} from '@helpers/caravan/caravan-trade';
import { getEntry } from '@helpers/content';
import { partyGet } from '@helpers/hero/party';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import { getGoldQuantity, getMaterialQuantity } from '@helpers/item/materials';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import { rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CaravanNodeState,
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
    ],
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

  it('returns false when the node is not a caravan', () => {
    vi.mocked(worldNodeCaravan).mockReturnValue(undefined);

    expect(caravanExecuteTrade(entry, 0)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false when no trader is currently assigned', () => {
    vi.mocked(caravanState).mockReturnValue(nodeState({ traderId: undefined }));

    expect(caravanExecuteTrade(entry, 0)).toBe(false);
  });

  it('returns false for a trade index that is not currently active', () => {
    vi.mocked(caravanState).mockReturnValue(
      nodeState({ activeTradeIndices: [1] }),
    );

    expect(caravanExecuteTrade(entry, 0)).toBe(false);
  });

  it('returns false once the trade is sold out', () => {
    vi.mocked(caravanState).mockReturnValue(
      nodeState({ tradeCounts: { 0: 2 } }),
    );

    expect(caravanExecuteTrade(entry, 0)).toBe(false);
  });

  it('returns false when the party cannot afford a sell trade', () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getGoldQuantity).mockReturnValue(0);

    expect(caravanExecuteTrade(entry, 0)).toBe(false);
  });

  it('grants the item and deducts gold on a successful sell trade', () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getGoldQuantity).mockReturnValue(1000);

    expect(caravanExecuteTrade(entry, 0)).toBe(true);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: { ['gold-coin' as ItemId]: { quantity: 1000, foundAt: 1 } },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      world: { caravans: { [caravan.id]: nodeState() } },
    } as unknown as GameState);

    expect(result.materials['ore' as ItemId].quantity).toBe(1);
    expect(result.materials['gold-coin' as ItemId].quantity).toBe(875);
    expect(result.world.caravans[caravan.id].tradeCounts[0]).toBe(1);
  });

  it('takes the item and credits gold on a successful buy trade', () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getMaterialQuantity).mockReturnValue(3);

    expect(caravanExecuteTrade(entry, 1)).toBe(true);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: { ['ore' as ItemId]: { quantity: 3, foundAt: 1 } },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      world: { caravans: { [caravan.id]: nodeState() } },
    } as unknown as GameState);

    expect(result.materials['ore' as ItemId].quantity).toBe(2);
    expect(result.materials['gold-coin' as ItemId].quantity).toBe(43);
    expect(result.world.caravans[caravan.id].tradeCounts[1]).toBe(1);
  });

  it('succeeds a buy trade even when the party currently has no gold', () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getMaterialQuantity).mockReturnValue(3);
    vi.mocked(getGoldQuantity).mockReturnValue(0);

    expect(caravanExecuteTrade(entry, 1)).toBe(true);
  });

  it('blocks buying an undiscovered collectible the party cannot afford, even though max quantity ignores gold', () => {
    vi.mocked(caravanState).mockReturnValue(
      nodeState({ activeTradeIndices: [0, 1, 2] }),
    );
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
    vi.mocked(getGoldQuantity).mockReturnValue(0);

    expect(caravanExecuteTrade(entry, 2)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false for a quantity of 0 or less', () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getGoldQuantity).mockReturnValue(1000);

    expect(caravanExecuteTrade(entry, 0, 0)).toBe(false);
    expect(caravanExecuteTrade(entry, 0, -1)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false when the requested quantity exceeds what is available', () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    // Trade 0 has limit 2 and none bought yet - only 2 are available.
    vi.mocked(getGoldQuantity).mockReturnValue(1_000_000);

    expect(caravanExecuteTrade(entry, 0, 3)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('buys multiple units in a single atomic commit', () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getGoldQuantity).mockReturnValue(1_000_000);

    expect(caravanExecuteTrade(entry, 0, 2)).toBe(true);

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

    // price 125 (100 marked up 25%) x2 = 250
    expect(result.materials['ore' as ItemId].quantity).toBe(2);
    expect(result.materials['gold-coin' as ItemId].quantity).toBe(999_750);
    expect(result.world.caravans[caravan.id].tradeCounts[0]).toBe(2);
  });

  it('sells multiple units in a single atomic commit', () => {
    vi.mocked(caravanState).mockReturnValue(nodeState());
    vi.mocked(getMaterialQuantity).mockReturnValue(5);

    expect(caravanExecuteTrade(entry, 1, 3)).toBe(true);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      materials: { ['ore' as ItemId]: { quantity: 5, foundAt: 1 } },
      discoveredMaterials: {},
      armory: [],
      collectibles: {},
      discoveredEquipment: {},
      world: { caravans: { [caravan.id]: nodeState() } },
    } as unknown as GameState);

    // price 43 (50 marked down 15%, rounded) x3 = 129
    expect(result.materials['ore' as ItemId].quantity).toBe(2);
    expect(result.materials['gold-coin' as ItemId].quantity).toBe(129);
    expect(result.world.caravans[caravan.id].tradeCounts[1]).toBe(3);
  });
});
