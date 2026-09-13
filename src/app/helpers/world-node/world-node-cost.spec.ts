import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/materials', () => ({
  getMaterialQuantity: vi.fn(),
  applyMaterialDelta: vi.fn(),
}));

import {
  applyMaterialDelta,
  getMaterialQuantity,
} from '@helpers/item/materials';
import {
  worldNodeCanAffordCost,
  worldNodeSpendCost,
} from '@helpers/world-node/world-node-cost';
import type { GameState, ItemId } from '@interfaces';

describe('worldNodeCanAffordCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true when every cost is affordable', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(100);

    expect(
      worldNodeCanAffordCost([
        { itemId: 'Gold Coin' as ItemId, required: 50 },
        { itemId: 'Wergen Stick' as ItemId, required: 50 },
      ]),
    ).toBe(true);
  });

  it('is false when any single cost is unaffordable', () => {
    vi.mocked(getMaterialQuantity).mockImplementation((itemId) =>
      itemId === 'Gold Coin' ? 100 : 0,
    );

    expect(
      worldNodeCanAffordCost([
        { itemId: 'Gold Coin' as ItemId, required: 50 },
        { itemId: 'Wergen Stick' as ItemId, required: 50 },
      ]),
    ).toBe(false);
  });

  it('is true for an empty cost list', () => {
    expect(worldNodeCanAffordCost([])).toBe(true);
  });
});

describe('worldNodeSpendCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies a negative delta for every cost entry', () => {
    const state = {} as GameState;

    worldNodeSpendCost(state, [
      { itemId: 'Gold Coin' as ItemId, required: 50 },
      { itemId: 'Wergen Stick' as ItemId, required: 10 },
    ]);

    expect(applyMaterialDelta).toHaveBeenCalledWith(state, 'Gold Coin', -50);
    expect(applyMaterialDelta).toHaveBeenCalledWith(state, 'Wergen Stick', -10);
  });
});
