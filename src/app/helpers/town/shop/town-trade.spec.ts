import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSafeSegment: vi.fn((s) => s),
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/item/materials', () => ({
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
import { getGoldQuantity, hasGold, spendGold } from '@helpers/item/materials';
import { updateGamestate } from '@helpers/state-game';
import { townStockPrice } from '@helpers/town/shop/town-price';
import { townStock, townStockDisplay } from '@helpers/town/shop/town-stock';
import {
  townExecuteTrade,
  townStockAffordable,
} from '@helpers/town/shop/town-trade';
import type {
  EquipmentId,
  GameState,
  TownContent,
  TownId,
} from '@interfaces';

const townId = 'larsia' as TownId;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntry).mockReturnValue({} as TownContent);
  vi.mocked(townStockDisplay).mockReturnValue(undefined);
});

describe('townStockAffordable', () => {
  it('is true when gold covers the price exactly or with room to spare', () => {
    expect(townStockAffordable(50, 50)).toBe(true);
    expect(townStockAffordable(50, 100)).toBe(true);
  });

  it('is false when gold falls short', () => {
    expect(townStockAffordable(50, 49)).toBe(false);
  });
});

describe('townExecuteTrade', () => {
  it('fails fast when the stock index is out of range', async () => {
    vi.mocked(townStock).mockReturnValue([
      { equipmentItem: { equipmentId: 'sword' as EquipmentId } as never, addedAtTick: 0 },
    ]);

    const result = await townExecuteTrade(townId, 5);

    expect(result).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the town content no longer resolves', async () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    vi.mocked(townStock).mockReturnValue([
      { equipmentItem: { equipmentId: 'sword' as EquipmentId } as never, addedAtTick: 0 },
    ]);

    const result = await townExecuteTrade(townId, 0);

    expect(result).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the price cannot be resolved', async () => {
    vi.mocked(townStock).mockReturnValue([
      { equipmentItem: { equipmentId: 'sword' as EquipmentId } as never, addedAtTick: 0 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(undefined);

    const result = await townExecuteTrade(townId, 0);

    expect(result).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when gold cannot afford the price', async () => {
    vi.mocked(townStock).mockReturnValue([
      { equipmentItem: { equipmentId: 'sword' as EquipmentId } as never, addedAtTick: 0 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(50);
    vi.mocked(getGoldQuantity).mockReturnValue(49);

    const result = await townExecuteTrade(townId, 0);

    expect(result).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when hasGold disagrees with the fast-path gold check', async () => {
    vi.mocked(townStock).mockReturnValue([
      { equipmentItem: { equipmentId: 'sword' as EquipmentId } as never, addedAtTick: 0 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(50);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(false);

    const result = await townExecuteTrade(townId, 0);

    expect(result).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('no-ops if the live town state disappeared before the commit ran', async () => {
    vi.mocked(townStock).mockReturnValue([
      { equipmentItem: { equipmentId: 'sword' as EquipmentId } as never, addedAtTick: 0 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(10);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(true);
    const state = {
      materials: { 'gold-coin': { quantity: 100 } },
      world: { towns: {} },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0);

    expect(result).toBe(false);
    expect(state.armory).toBeUndefined();
  });

  it('grants and removes an equipment entry into the armory on a successful buy', async () => {
    const equipmentItem = { id: 'sword-1', equipmentId: 'sword' as EquipmentId } as never;
    vi.mocked(townStock).mockReturnValue([{ equipmentItem, addedAtTick: 0 }]);
    vi.mocked(townStockPrice).mockReturnValue(50);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(true);
    const state = {
      materials: { 'gold-coin': { quantity: 100 } },
      armory: [],
      discoveredEquipment: {},
      world: {
        towns: { [townId]: { stock: [{ equipmentItem, addedAtTick: 0 }] } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0);

    expect(result).toBe(true);
    expect(state.armory).toEqual([equipmentItem]);
    expect(state.discoveredEquipment['sword']).toBeDefined();
    expect(spendGold).toHaveBeenCalledWith(expect.anything(), 50);
    expect(state.world.towns[townId].stock).toEqual([]);
    expect(analyticsSendDesignEvent).toHaveBeenCalled();
  });

  it('re-validates against live state and fails if stock changed since the fast-path check', async () => {
    const staleEquipment = { id: 'sword-1', equipmentId: 'sword' as EquipmentId } as never;
    vi.mocked(townStock).mockReturnValue([
      { equipmentItem: staleEquipment, addedAtTick: 0 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(50);
    vi.mocked(getGoldQuantity).mockReturnValue(100);
    vi.mocked(hasGold).mockReturnValue(true);
    // Live state has no stock left by the time the commit runs.
    const state = {
      materials: { 'gold-coin': { quantity: 100 } },
      armory: [],
      world: { towns: { [townId]: { stock: [] } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0);

    expect(result).toBe(false);
    expect(state.armory).toEqual([]);
  });

  it('fails rather than charge the fast-path price if a different entry has shifted into that index', async () => {
    // A prior purchase removed index 0 and shifted this equipment entry down into it.
    const pricedEquipment = { id: 'priced-sword', equipmentId: 'sword' as EquipmentId } as never;
    vi.mocked(townStock).mockReturnValue([
      { equipmentItem: pricedEquipment, addedAtTick: 0 },
    ]);
    vi.mocked(townStockPrice).mockReturnValue(50);
    vi.mocked(getGoldQuantity).mockReturnValue(1000);
    vi.mocked(hasGold).mockReturnValue(true);
    const shiftedEntry = {
      equipmentItem: { id: 'shifted-sword', equipmentId: 'sword' as EquipmentId } as never,
      addedAtTick: 0,
    };
    const state = {
      materials: { 'gold-coin': { quantity: 1000 } },
      armory: [],
      discoveredEquipment: {},
      world: {
        towns: { [townId]: { stock: [shiftedEntry] } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    const result = await townExecuteTrade(townId, 0);

    expect(result).toBe(false);
    expect(state.armory).toEqual([]);
    expect(state.world.towns[townId].stock).toEqual([shiftedEntry]);
  });
});
