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
  pruneInvalidMaterials,
  removeMaterial,
  spendGold,
} from '@helpers/item/materials';
import { gamestate } from '@helpers/state-game';
import type { GameState, ItemId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const goldId = 'gold-coin' as ItemId;
const scripId = 'trader-scrip' as ItemId;
const oreId = 'ore' as ItemId;
const staleId = 'stale' as ItemId;

beforeEach(() => {
  seedContent([
    ensureItem({ id: goldId, name: 'Gold Coin' }),
    ensureItem({ id: scripId, name: 'Trader Scrip' }),
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
});

describe('pruneInvalidMaterials', () => {
  it('drops only the entries that no longer resolve to content', () => {
    expect(
      pruneInvalidMaterials({
        [oreId]: { quantity: 5, foundAt: 1000 },
        [staleId]: { quantity: 2, foundAt: 2000 },
      }),
    ).toEqual({ [oreId]: { quantity: 5, foundAt: 1000 } });
  });
});
