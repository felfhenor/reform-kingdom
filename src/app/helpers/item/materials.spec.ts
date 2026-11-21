import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STARTING_GOLD_AMOUNT } from '@helpers/config';
import { ensureItem } from '@helpers/content/ensure-item';
import { defaultGameState } from '@helpers/defaults';
import {
  addMaterial,
  applyMaterialDelta,
  gainGold,
  getGoldQuantity,
  getMaterialQuantity,
  grantStartingGold,
  hasTraderTokens,
  isMaterialDiscovered,
  loseCurrency,
  loseRandomMaterials,
  removeMaterial,
  scaledMaterialCost,
  spendGold,
} from '@helpers/item/materials';
import { rngSeeded } from '@helpers/rng';
import { gamestate } from '@helpers/state-game';
import type { GameState, ItemId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const goldId = 'gold-coin' as ItemId;
const scripId = 'trader-scrip' as ItemId;
const lucreId = 'crimson-lucre' as ItemId;
const fluxId = 'memory-flux' as ItemId;
const reagentId = 'duskhall-flux' as ItemId;
const oreId = 'ore' as ItemId;

beforeEach(() => {
  seedContent([
    ensureItem({ id: goldId, name: 'Gold Coin' }),
    ensureItem({ id: scripId, name: 'Trader Scrip' }),
    ensureItem({ id: lucreId, name: 'Crimson Lucre' }),
    ensureItem({ id: fluxId, name: 'Memory Flux' }),
    ensureItem({ id: reagentId, name: 'Duskhall Flux' }),
    ensureItem({ id: oreId, name: 'Ore' }),
  ]);
  vi.spyOn(Date, 'now').mockReturnValue(5000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function stateWithOre(quantity: number, foundAt = 1000): GameState {
  const state = defaultGameState();
  state.materials[oreId] = { quantity, foundAt };
  state.discoveredMaterials[oreId] = { foundAt };
  return state;
}

describe('applyMaterialDelta', () => {
  it('adds to an existing quantity, preserving foundAt', () => {
    const state = stateWithOre(5);

    applyMaterialDelta(state, oreId, 10);

    expect(state.materials[oreId]).toEqual({ quantity: 15, foundAt: 1000 });
  });

  it('creates a new material stamped now, and records it as discovered', () => {
    const state = defaultGameState();

    applyMaterialDelta(state, oreId, 3);

    expect(state.materials[oreId]).toEqual({ quantity: 3, foundAt: 5000 });
    expect(state.discoveredMaterials[oreId]).toEqual({ foundAt: 5000 });
  });

  it('leaves a remaining positive quantity in place when partially subtracted', () => {
    const state = stateWithOre(10);

    applyMaterialDelta(state, oreId, -4);

    expect(state.materials[oreId]).toEqual({ quantity: 6, foundAt: 1000 });
  });

  it('clamps at 0 and drops the entry once depleted', () => {
    const state = stateWithOre(10);

    applyMaterialDelta(state, oreId, -100);

    expect(state.materials[oreId]).toBeUndefined();
  });

  it('keeps the original discovery after the material is depleted and regained', () => {
    const state = stateWithOre(10);

    applyMaterialDelta(state, oreId, -10);
    applyMaterialDelta(state, oreId, 3);

    expect(state.materials[oreId]).toEqual({ quantity: 3, foundAt: 5000 });
    expect(state.discoveredMaterials[oreId]).toEqual({ foundAt: 1000 });
  });

  it('does not record a discovery for a negative delta', () => {
    const state = defaultGameState();
    state.materials[oreId] = { quantity: 10, foundAt: 1000 };

    applyMaterialDelta(state, oreId, -4);

    expect(state.discoveredMaterials[oreId]).toBeUndefined();
  });
});

describe('addMaterial/removeMaterial', () => {
  it('adds to the committed state', () => {
    seedGamestate((state) => applyMaterialDelta(state, oreId, 5));

    inTick(() => addMaterial(oreId, 10));

    expect(getMaterialQuantity(oreId)).toBe(15);
  });

  it('subtracts from the committed state, never going negative', () => {
    seedGamestate((state) => applyMaterialDelta(state, oreId, 5));

    inTick(() => removeMaterial(oreId, 100));

    expect(gamestate().materials[oreId]).toBeUndefined();
    expect(getMaterialQuantity(oreId)).toBe(0);
  });
});

describe('isMaterialDiscovered', () => {
  it('stays true after the material is fully depleted from storage', () => {
    seedGamestate((state) => {
      applyMaterialDelta(state, oreId, 5);
      applyMaterialDelta(state, oreId, -5);
    });

    expect(getMaterialQuantity(oreId)).toBe(0);
    expect(isMaterialDiscovered(oreId)).toBe(true);
  });

  it('is false for a material that has never been found', () => {
    seedGamestate();

    expect(isMaterialDiscovered(oreId)).toBe(false);
  });
});

describe('gold and trader scrip', () => {
  it('reads, gains and spends gold through the Gold Coin item', () => {
    seedGamestate((state) => {
      gainGold(state, 10);
      spendGold(state, 4);
    });

    expect(getGoldQuantity()).toBe(6);
  });

  it('grants the starting gold on top of any existing gold', () => {
    const state = defaultGameState();
    gainGold(state, 5);

    grantStartingGold(state);

    expect(state.materials[goldId]?.quantity).toBe(STARTING_GOLD_AMOUNT + 5);
  });

  it('checks trader scrip against the requested amount', () => {
    seedGamestate((state) => applyMaterialDelta(state, scripId, 5));

    expect(hasTraderTokens(5)).toBe(true);
    expect(hasTraderTokens(6)).toBe(false);
  });

  it('loses every Gold Coin and Crimson Lucre but nothing else', () => {
    const state = stateWithOre(5);
    gainGold(state, 10);
    applyMaterialDelta(state, lucreId, 3);

    loseCurrency(state, 100);

    expect(state.materials[goldId]).toBeUndefined();
    expect(state.materials[lucreId]).toBeUndefined();
    expect(state.materials[oreId]?.quantity).toBe(5);
  });

  it('loses a partial share of currency rounded down, and reports the total lost', () => {
    const state = defaultGameState();
    gainGold(state, 5);
    applyMaterialDelta(state, lucreId, 3);

    expect(loseCurrency(state, 50)).toBe(3);
    expect(state.materials[goldId]?.quantity).toBe(3);
    expect(state.materials[lucreId]?.quantity).toBe(2);
  });
});

describe('scaledMaterialCost', () => {
  it('scales by the boost and rounds down', () => {
    expect(scaledMaterialCost(4, 0)).toBe(4);
    expect(scaledMaterialCost(3, 0.5)).toBe(4);
    expect(scaledMaterialCost(5, -0.5)).toBe(2);
  });

  it('never drops below 1, even past -100%', () => {
    expect(scaledMaterialCost(1, -0.5)).toBe(1);
    expect(scaledMaterialCost(10, -2)).toBe(1);
  });
});

describe('loseRandomMaterials', () => {
  const protectedIds = [goldId, lucreId, scripId, fluxId, reagentId];
  const commonIds = ['a', 'b', 'c', 'd'] as ItemId[];

  function stocked(quantity: number): GameState {
    const state = defaultGameState();
    for (const id of [...protectedIds, ...commonIds]) {
      applyMaterialDelta(state, id, quantity);
    }
    return state;
  }

  it('halves a random half of the unprotected stacks', () => {
    const state = stocked(10);

    loseRandomMaterials(state, 50, 50, rngSeeded('crows'));

    const quantities = commonIds.map((id) => state.materials[id]?.quantity);
    expect(quantities.filter((q) => q === 5)).toHaveLength(2);
    expect(quantities.filter((q) => q === 10)).toHaveLength(2);
    for (const id of protectedIds) {
      expect(state.materials[id]?.quantity).toBe(10);
    }
  });

  it('never takes the last of a stack of 1', () => {
    const state = stocked(1);

    loseRandomMaterials(state, 50, 50, rngSeeded('crows'));

    for (const id of commonIds) expect(state.materials[id]?.quantity).toBe(1);
  });

  it('rounds the number of picked stacks down', () => {
    const state = defaultGameState();
    for (const id of ['a', 'b', 'c'] as ItemId[]) {
      applyMaterialDelta(state, id, 10);
    }

    expect(loseRandomMaterials(state, 50, 50, rngSeeded('crows'))).toBe(5);
  });

  it('picks nothing from a single unprotected stack at 50%', () => {
    const state = stocked(10);
    for (const id of commonIds.slice(1)) delete state.materials[id];

    expect(loseRandomMaterials(state, 50, 50, rngSeeded('crows'))).toBe(0);
  });
});
