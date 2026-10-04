import { describe, expect, it } from 'vitest';

import { defaultGameState } from '@helpers/defaults';
import { applyMaterialDelta } from '@helpers/item/materials';
import {
  worldNodeCanAffordCost,
  worldNodeSpendCost,
} from '@helpers/world-node/world-node-cost';
import type { ItemId } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';

const gold = 'Gold Coin' as ItemId;
const stick = 'Wergen Stick' as ItemId;
const costs = [
  { itemId: gold, required: 50 },
  { itemId: stick, required: 10 },
];

describe('worldNodeCanAffordCost', () => {
  it('needs every cost covered, and an empty cost is always affordable', () => {
    seedGamestate((state) => {
      applyMaterialDelta(state, gold, 50);
      applyMaterialDelta(state, stick, 10);
    });
    expect(worldNodeCanAffordCost(costs)).toBe(true);

    seedGamestate((state) => {
      applyMaterialDelta(state, gold, 100);
      applyMaterialDelta(state, stick, 9);
    });
    expect(worldNodeCanAffordCost(costs)).toBe(false);
    expect(worldNodeCanAffordCost([])).toBe(true);
  });
});

describe('worldNodeSpendCost', () => {
  it('spends every cost from stock', () => {
    const state = defaultGameState();
    applyMaterialDelta(state, gold, 80);
    applyMaterialDelta(state, stick, 10);

    worldNodeSpendCost(state, costs);

    expect(state.materials[gold]?.quantity).toBe(30);
    expect(state.materials[stick]?.quantity ?? 0).toBe(0);
  });
});
