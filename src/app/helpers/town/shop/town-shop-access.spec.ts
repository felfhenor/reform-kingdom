import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import type { TownContent, TownId } from '@interfaces';

const townId = 'larsia' as TownId;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townShopItemCap', () => {
  it("reads the town content's sellItemCount", () => {
    vi.mocked(getEntry).mockReturnValue({
      traders: { sellItemCount: 10 },
    } as TownContent);

    expect(townShopItemCap(townId)).toBe(10);
  });

  it('returns 0 when the town no longer resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(townShopItemCap(townId)).toBe(0);
  });
});
