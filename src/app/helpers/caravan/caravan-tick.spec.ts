import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/caravan/caravan', () => ({
  caravanEligibleTraders: vi.fn(),
}));

vi.mock('@helpers/item/collectibles', () => ({
  isCollectibleDiscovered: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeCaravan: vi.fn(),
  worldNodesOfType: vi.fn(),
}));

import { caravanEligibleTraders } from '@helpers/caravan/caravan';
import {
  caravanProcessTick,
  caravanWeightedSample,
} from '@helpers/caravan/caravan-tick';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  worldNodeCaravan,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CaravanTraderContent,
  CaravanTraderId,
  CollectibleId,
  GameState,
  ItemId,
  WorldNodeEntry,
} from '@interfaces';

describe('caravanWeightedSample', () => {
  it('returns every item when count exceeds the pool size', () => {
    const items = [{ weight: 1 }, { weight: 1 }];
    expect(caravanWeightedSample(items, 5)).toHaveLength(2);
  });

  it('returns exactly `count` items without duplicates from a larger pool', () => {
    const items = [
      { id: 1, weight: 1 },
      { id: 2, weight: 1 },
      { id: 3, weight: 1 },
      { id: 4, weight: 1 },
    ];

    const picked = caravanWeightedSample(items, 2);

    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((p) => p.id)).size).toBe(2);
  });

  it('returns an empty array for a count of 0', () => {
    expect(caravanWeightedSample([{ weight: 1 }], 0)).toEqual([]);
  });

  it('returns an empty array when every weight is 0', () => {
    expect(caravanWeightedSample([{ weight: 0 }, { weight: 0 }], 2)).toEqual(
      [],
    );
  });
});

const entry = { nodeName: 'Duchy Trading Caravan - Carrina' } as WorldNodeEntry;
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

function trader(
  overrides: Partial<CaravanTraderContent> = {},
): CaravanTraderContent {
  return {
    id: 'trader-a' as CaravanTraderId,
    name: 'Trader A',
    __type: 'caravantrader',
    description: 'A trader.',
    category: 'Carrina',
    level: 5,
    trades: [],
    ...overrides,
  };
}

function withCaravanState(caravans: Record<string, unknown>): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { caravans },
  } as unknown as GameState);
}

describe('caravanProcessTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(worldNodesOfType).mockReturnValue([entry]);
    vi.mocked(worldNodeCaravan).mockReturnValue(caravan);
    vi.mocked(timerTicksElapsed).mockReturnValue(1000);
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not regenerate before traderResetTime has elapsed', () => {
    withCaravanState({
      [caravan.id]: { generatedAtTick: 950, traderId: undefined },
    });

    caravanProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('regenerates on the first tick when no state exists yet', () => {
    withCaravanState({});
    vi.mocked(caravanEligibleTraders).mockReturnValue([trader()]);

    caravanProcessTick();

    expect(updateGamestate).toHaveBeenCalledTimes(1);
    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      world: { caravans: {} },
    } as unknown as GameState);

    expect(result.world.caravans[caravan.id]).toEqual({
      traderId: 'trader-a',
      activeTradeIndices: [],
      tradeCounts: {},
      generatedAtTick: 1000,
    });
  });

  it('assigns no trader when none are eligible', () => {
    withCaravanState({
      [caravan.id]: { generatedAtTick: 800, traderId: 'trader-a' },
    });
    vi.mocked(caravanEligibleTraders).mockReturnValue([]);

    caravanProcessTick();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      world: { caravans: {} },
    } as unknown as GameState);

    expect(result.world.caravans[caravan.id].traderId).toBeUndefined();
    expect(result.world.caravans[caravan.id].activeTradeIndices).toEqual([]);
  });

  it('reuses the only eligible trader even if it was the previous one', () => {
    withCaravanState({
      [caravan.id]: { generatedAtTick: 800, traderId: 'trader-a' },
    });
    vi.mocked(caravanEligibleTraders).mockReturnValue([trader()]);

    caravanProcessTick();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      world: { caravans: {} },
    } as unknown as GameState);

    expect(result.world.caravans[caravan.id].traderId).toBe('trader-a');
  });

  it('picks a different trader than last cycle when more than one is eligible', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    withCaravanState({
      [caravan.id]: { generatedAtTick: 800, traderId: 'trader-a' },
    });
    const traderA = trader({ id: 'trader-a' as CaravanTraderId });
    const traderB = trader({ id: 'trader-b' as CaravanTraderId });
    vi.mocked(caravanEligibleTraders).mockReturnValue([traderA, traderB]);

    caravanProcessTick();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      world: { caravans: {} },
    } as unknown as GameState);

    expect(result.world.caravans[caravan.id].traderId).toBe('trader-b');
  });

  it('excludes an already-discovered unique collectible sell from the active trades', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    withCaravanState({});

    const withCollectible = trader({
      trades: [
        {
          type: 'sell',
          value: 100,
          collectibleId: 'unique-thing' as CollectibleId,
          weight: 5,
        },
        { type: 'sell', value: 10, itemId: 'ore' as ItemId, weight: 1 },
      ],
    });
    vi.mocked(caravanEligibleTraders).mockReturnValue([withCollectible]);
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);

    caravanProcessTick();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      world: { caravans: {} },
    } as unknown as GameState);

    expect(result.world.caravans[caravan.id].activeTradeIndices).toEqual([1]);
  });
});
