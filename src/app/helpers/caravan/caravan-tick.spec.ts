import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  caravanProcessTick,
  caravanWeightedSample,
} from '@helpers/caravan/caravan-tick';
import { ACTIVE_TRADE_COUNT } from '@helpers/config';
import {
  ensureCaravan,
  ensureCaravanTrader,
} from '@helpers/content/ensure-caravan';
import { ensureEquipment } from '@helpers/content/ensure-item';
import { ledgerMark } from '@helpers/engine/ledger';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { worldCaravansState } from '@helpers/state-game';
import type {
  CaravanId,
  CaravanNodeState,
  CaravanTrade,
  CaravanTraderContent,
  CaravanTraderId,
  CollectibleId,
  EquipmentId,
  GameState,
  ItemId,
  RecipeId,
} from '@interfaces';
import { buildCaravanNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const caravan = ensureCaravan({
  id: 'carrina-duchy' as CaravanId,
  name: 'Duchy Trading Caravan - Carrina',
  traderResetTime: 100,
  level: { min: 1, max: 10 },
  traderCategories: ['Carrina'],
});
const otherCaravan = ensureCaravan({
  id: 'elfheim-duchy' as CaravanId,
  name: 'Duchy Trading Caravan - Elfheim',
  traderCategories: ['Carrina'],
  level: { min: 1, max: 10 },
});
const traderA = 'trader-a' as CaravanTraderId;
const traderB = 'trader-b' as CaravanTraderId;
const helmId = 'copper-helm' as EquipmentId;
const now = 1000;

function trader(
  id: CaravanTraderId,
  trades: Partial<CaravanTrade>[] = [],
): CaravanTraderContent {
  return ensureCaravanTrader({
    id,
    name: id,
    category: 'Carrina',
    level: 5,
    trades: trades as CaravanTrade[],
  });
}

const oreTrade = { type: 'sell', itemId: 'ore' as ItemId } as const;

function seedTraders(...traders: CaravanTraderContent[]): void {
  seedContent([
    caravan,
    otherCaravan,
    ensureEquipment({ id: helmId, name: 'Copper Helm' }),
    ...traders,
  ]);
}

function seedCaravans(
  caravans: Partial<Record<CaravanId, CaravanNodeState>> = {},
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate((state) => {
    state.clock.numTicks = now;
    Object.assign(state.world.caravans, caravans);
    edit(state);
  });
}

function expired(overrides: Partial<CaravanNodeState> = {}): CaravanNodeState {
  return buildCaravanNodeState({
    generatedAtTick: now - caravan.traderResetTime,
    ...overrides,
  });
}

function rerolled(): CaravanNodeState {
  inTick(caravanProcessTick);
  return worldCaravansState()[caravan.id];
}

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  seedWorldNodes([
    { name: caravan.name, type: 'CaravanNode', x: 1 },
    { name: 'Nowhere Caravan', type: 'CaravanNode', x: 2 },
  ]);
});

describe('caravanWeightedSample', () => {
  it('picks up to `count` distinct items, stopping when nothing has weight', () => {
    vi.mocked(Math.random).mockRestore();
    const items = [1, 2, 3, 4].map((id) => ({ id, weight: 1 }));

    const picked = caravanWeightedSample(items, 2);
    expect(new Set(picked.map((p) => p.id)).size).toBe(2);

    expect(caravanWeightedSample(items, 5)).toHaveLength(4);
    expect(caravanWeightedSample([{ weight: 0 }, { weight: 0 }], 2)).toEqual(
      [],
    );
  });
});

describe('caravanProcessTick', () => {
  it('waits out the reset time before rerolling', () => {
    seedTraders(trader(traderA));
    const fresh = buildCaravanNodeState({ generatedAtTick: now - 1 });
    seedCaravans({ [caravan.id]: fresh });

    expect(rerolled()).toEqual(fresh);
  });

  it('staffs a caravan seen for the first time, with a fresh trade cycle', () => {
    seedTraders(trader(traderA, [oreTrade]));
    seedCaravans();

    expect(rerolled()).toEqual({
      traderId: traderA,
      visitedTraderId: undefined,
      activeTradeIndices: [0],
      rolledEquipment: {},
      tradeCounts: {},
      generatedAtTick: now,
    });
  });

  it('leaves the caravan unstaffed when no trader is eligible', () => {
    seedTraders(ensureCaravanTrader({ id: traderA, category: 'Elfheim' }));
    seedCaravans({ [caravan.id]: expired({ traderId: traderA }) });

    expect(rerolled()).toMatchObject({
      traderId: undefined,
      activeTradeIndices: [],
    });
  });

  it('swaps in a different trader when it can, forgetting the visit and past sales', () => {
    seedTraders(trader(traderA), trader(traderB));
    seedCaravans({
      [caravan.id]: expired({
        traderId: traderA,
        visitedTraderId: traderA,
        tradeCounts: { 0: 3 },
      }),
    });

    const caravanState = rerolled();
    expect(caravanState).toMatchObject({
      traderId: traderB,
      visitedTraderId: undefined,
    });
    expect(caravanState.tradeCounts).toEqual({});
  });

  it('reuses the only eligible trader, keeping the visit', () => {
    seedTraders(trader(traderA));
    seedCaravans({
      [caravan.id]: expired({ traderId: traderA, visitedTraderId: traderA }),
    });

    expect(rerolled()).toMatchObject({
      traderId: traderA,
      visitedTraderId: traderA,
    });
  });

  it('never stations a trader already staffing another camp', () => {
    seedTraders(trader(traderA), trader(traderB));
    const busyB = buildCaravanNodeState({
      traderId: traderB,
      generatedAtTick: now,
    });
    seedCaravans({
      [caravan.id]: expired({ traderId: traderA }),
      [otherCaravan.id]: busyB,
    });
    expect(rerolled().traderId).toBe(traderA);

    seedTraders(trader(traderB));
    seedCaravans({ [caravan.id]: expired(), [otherCaravan.id]: busyB });
    expect(rerolled().traderId).toBeUndefined();
  });

  it('retires unique collectible and recipe sells the party already owns', () => {
    const collectibleId = 'unique-thing' as CollectibleId;
    const recipeId = 'recipe-a' as RecipeId;
    seedTraders(
      trader(traderA, [
        { type: 'sell', collectibleId, weight: 5 },
        { type: 'sell', recipeId, weight: 5 },
        oreTrade,
      ]),
    );
    seedCaravans({}, (state) => {
      applyCollectibleGrant(state, collectibleId, 1);
      ledgerMark(state.discoveredRecipes, recipeId);
    });

    expect(rerolled().activeTradeIndices).toEqual([2]);
  });

  it(`stocks at most ${ACTIVE_TRADE_COUNT} trades a cycle`, () => {
    const trades = Array.from(
      { length: ACTIVE_TRADE_COUNT + 1 },
      () => oreTrade,
    );
    seedTraders(trader(traderA, trades));
    seedCaravans();

    expect(rerolled().activeTradeIndices).toHaveLength(ACTIVE_TRADE_COUNT);
  });

  it('pre-rolls an instance for each active equipment sell, not for buys', () => {
    seedTraders(
      trader(traderA, [
        { type: 'buy', equipmentId: helmId },
        { type: 'sell', equipmentId: helmId },
      ]),
    );
    seedCaravans();

    const { rolledEquipment } = rerolled();

    expect(Object.keys(rolledEquipment ?? {})).toEqual(['1']);
    expect(rolledEquipment?.[1]?.equipmentId).toBe(helmId);
  });
});
