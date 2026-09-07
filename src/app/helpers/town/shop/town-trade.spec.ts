import { describe, expect, it } from 'vitest';

import { townStockAffordable } from '@helpers/town/shop/town-trade';

describe('townStockAffordable', () => {
  it('is true when gold covers the price exactly or with room to spare', () => {
    expect(townStockAffordable(50, 50)).toBe(true);
    expect(townStockAffordable(50, 100)).toBe(true);
  });

  it('is false when gold falls short', () => {
    expect(townStockAffordable(50, 49)).toBe(false);
  });
});
