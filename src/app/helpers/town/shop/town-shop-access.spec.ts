import { describe, expect, it } from 'vitest';

import { ensureTown } from '@helpers/content/ensure-town';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import type { TownId } from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;

function seedTownAtTier(
  tier: number,
  sellItemCount: { tier: number; value: number }[],
): void {
  seedContent([ensureTown({ id: townId, traders: { sellItemCount } })]);
  seedGamestate(
    (state) =>
      (state.world.towns[townId] = buildTownNodeState({
        reputation: TOWN_REPUTATION_THRESHOLDS[tier],
      })),
  );
}

describe('townShopItemCap', () => {
  it('uses the cap of the town’s reputation tier, or the nearest listed tier below it', () => {
    const caps = [
      { tier: 0, value: 5 },
      { tier: 3, value: 11 },
    ];

    seedTownAtTier(3, caps);
    expect(townShopItemCap(townId)).toBe(11);

    seedTownAtTier(2, caps);
    expect(townShopItemCap(townId)).toBe(5);
  });

  it('is 0 with no cap at or below the tier, or for a town gone from content', () => {
    seedTownAtTier(2, []);
    expect(townShopItemCap(townId)).toBe(0);

    seedContent([]);
    expect(townShopItemCap(townId)).toBe(0);
  });
});
