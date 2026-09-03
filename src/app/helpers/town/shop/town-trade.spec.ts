import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSafeSegment: vi.fn((s) => s),
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/item/materials', () => ({
  applyMaterialDelta: vi.fn(),
  getGoldQuantity: vi.fn(),
  goldCoinId: vi.fn(() => 'gold-coin'),
  hasGold: vi.fn(),
  spendGold: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/shop/town-price', () => ({
  townStockPrice: vi.fn(),
}));

vi.mock('@helpers/town/shop/town-stock', () => ({
  townStock: vi.fn(),
  townStockDisplay: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import {
  applyMaterialDelta,
  getGoldQuantity,
  hasGold,
  spendGold,
} from '@helpers/item/materials';
import { updateGamestate } from '@helpers/state-game';
import { townStockPrice } from '@helpers/town/shop/town-price';
import { townStock, townStockDisplay } from '@helpers/town/shop/town-stock';
import {
  townExecuteTrade,
  townStockMaxQuantity,
} from '@helpers/town/shop/town-trade';
import type {
  EquipmentId,
  GameState,
  ItemId,
  TownContent,
  TownId,
  TownStockEntry,
} from '@interfaces';

const townId = 'larsia' as TownId;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntry).mockReturnValue({} as TownContent);
  vi.mocked(townStockDisplay).mockReturnValue(undefined);
});

describe('townStockMaxQuantity', () => {
  it('caps an item entry at the lesser of stock quantity and what gold affords', () => {
    const entry: TownStockEntry = { itemId: 'ore' as ItemId, quantity: 10 };

    expect(townStockMaxQuantity(entry, 5, 22)).toBe(4);
    expect(townStockMaxQuantity(entry, 5, 100)).toBe(10);
  });

  it('caps an equipment entry at 1 if affordable, 0 otherwise', () => {
    const entry: TownStockEntry = {
      equipmentItem: { equipmentId: 'sword' as EquipmentId } as never,
    };

    expect(townStockMaxQuantity(entry, 50, 50)).toBe(1);
    expect(townStockMaxQuantity(entry, 50, 49)).toBe(0);
  });
});

describe('townExecuteTrade', () => {
  it('fails fast when the stock index is out of range', async () => {
    vi.mocked(townStock).mockReturnValue([
      { itemId: 'ore' as ItemId, quantity: 5 },
    ]);

    const result = await townExecuteTrade(townId, 5);

    expect(result).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('no-ops if the live town state disappeared before the commit ran', async () => {
    vi.mocked(townStock).mockReturnValue([
      { itemId: 'ore' as ItemId, quantity: 5 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(10);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(true);
    const state = {
      materials: { 'gold-coin': { quantity: 100 } },
      world: { towns: {} },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0, 1);

    expect(result).toBe(false);
    expect(applyMaterialDelta).not.toHaveBeenCalled();
  });

  it('fails when the requested quantity exceeds the fast-path max', async () => {
    vi.mocked(townStock).mockReturnValue([
      { itemId: 'ore' as ItemId, quantity: 2 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(10);
    vi.mocked(getGoldQuantity).mockReturnValue(15);

    const result = await townExecuteTrade(townId, 0, 3);

    expect(result).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the player cannot afford the total price', async () => {
    vi.mocked(townStock).mockReturnValue([
      { itemId: 'ore' as ItemId, quantity: 5 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(10);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(false);

    const result = await townExecuteTrade(townId, 0, 2);

    expect(result).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('grants an item, spends gold, and decrements stock on a successful item buy', async () => {
    vi.mocked(townStock).mockReturnValue([
      { itemId: 'ore' as ItemId, quantity: 5 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(10);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(true);
    const state = {
      materials: { 'gold-coin': { quantity: 100 } },
      world: {
        towns: {
          [townId]: {
            stock: [{ itemId: 'ore' as ItemId, quantity: 5 }],
          },
        },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0, 2);

    expect(result).toBe(true);
    expect(applyMaterialDelta).toHaveBeenCalledWith(
      expect.anything(),
      'ore',
      2,
    );
    expect(spendGold).toHaveBeenCalledWith(expect.anything(), 20);
    expect(state.world.towns[townId].stock).toEqual([
      { itemId: 'ore' as ItemId, quantity: 3 },
    ]);
    expect(analyticsSendDesignEvent).toHaveBeenCalled();
  });

  it('removes the stock entry outright once its quantity is fully bought', async () => {
    vi.mocked(townStock).mockReturnValue([
      { itemId: 'ore' as ItemId, quantity: 2 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(10);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(true);
    const state = {
      materials: { 'gold-coin': { quantity: 100 } },
      world: {
        towns: {
          [townId]: {
            stock: [{ itemId: 'ore' as ItemId, quantity: 2 }],
          },
        },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0, 2);

    expect(result).toBe(true);
    expect(state.world.towns[townId].stock).toEqual([]);
  });

  it('grants and removes an equipment entry into the armory on a successful buy', async () => {
    const equipmentItem = { equipmentId: 'sword' as EquipmentId } as never;
    vi.mocked(townStock).mockReturnValue([{ equipmentItem }]);
    vi.mocked(townStockPrice).mockReturnValue(50);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(true);
    const state = {
      materials: { 'gold-coin': { quantity: 100 } },
      armory: [],
      discoveredEquipment: {},
      world: {
        towns: { [townId]: { stock: [{ equipmentItem }] } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0, 1);

    expect(result).toBe(true);
    expect(state.armory).toEqual([equipmentItem]);
    expect(state.discoveredEquipment['sword']).toBeDefined();
    expect(state.world.towns[townId].stock).toEqual([]);
  });

  it('re-validates against live state and fails if stock changed since the fast-path check', async () => {
    vi.mocked(townStock).mockReturnValue([
      { itemId: 'ore' as ItemId, quantity: 5 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(10);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(true);
    // Live state only has 1 left by the time the commit runs.
    const state = {
      materials: { 'gold-coin': { quantity: 100 } },
      world: {
        towns: {
          [townId]: {
            stock: [{ itemId: 'ore' as ItemId, quantity: 1 }],
          },
        },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0, 5);

    expect(result).toBe(false);
    expect(state.world.towns[townId].stock).toEqual([
      { itemId: 'ore' as ItemId, quantity: 1 },
    ]);
    expect(applyMaterialDelta).not.toHaveBeenCalled();
  });

  it('fails rather than charge the fast-path price if a different entry has shifted into that index', async () => {
    // A prior purchase removed index 0 and shifted this equipment entry down into it.
    vi.mocked(townStock).mockReturnValue([
      { itemId: 'ore' as ItemId, quantity: 5 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(10);
    vi.mocked(getGoldQuantity).mockReturnValue(1000);
    vi.mocked(hasGold).mockReturnValue(true);
    const shiftedEquipment = {
      equipmentItem: { id: 'shifted-sword', equipmentId: 'sword' as EquipmentId } as never,
    };
    const state = {
      materials: { 'gold-coin': { quantity: 1000 } },
      armory: [],
      discoveredEquipment: {},
      world: {
        towns: { [townId]: { stock: [shiftedEquipment] } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0, 1);

    expect(result).toBe(false);
    expect(state.armory).toEqual([]);
    expect(state.world.towns[townId].stock).toEqual([shiftedEquipment]);
    expect(applyMaterialDelta).not.toHaveBeenCalled();
  });
});
