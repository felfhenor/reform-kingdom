import { describe, expect, it } from 'vitest';

import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import {
  farmableExploreNodes,
  farmNodeRewardQuantity,
} from '@helpers/decree/decree-farm-node';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { applyMaterialDelta } from '@helpers/item/materials';
import type {
  CollectibleId,
  EquipmentId,
  ItemId,
  RecipeId,
  WorkerId,
} from '@interfaces';
import { buildEquipmentItem } from '@/testing/builders';
import { explore, mystical, seedDecreeWorld } from '@/testing/decree';
import { seedGamestate } from '@/testing/gamestate';

const relic = 'shrine-relic' as CollectibleId;
const lotus = 'lotus' as CollectibleId;
const flux = 'flux' as ItemId;

const guaranteed = {
  relic: ensureDroppedReward({ collectibleId: relic, chance: 100 }),
  lotus: ensureDroppedReward({ collectibleId: lotus, chance: 100 }),
  flux: ensureDroppedReward({ itemId: flux, chance: 100 }),
  maybeRelic: ensureDroppedReward({ collectibleId: relic, chance: 50 }),
};

describe('farmableExploreNodes', () => {
  it('lists explore nodes with any reward found, and mystical nodes whose guaranteed unique reward was found', () => {
    const nodes = seedDecreeWorld(
      [
        {
          content: explore('Beaten', 1, 1, {
            completionRewards: [guaranteed.flux, guaranteed.lotus],
          }),
        },
        {
          content: explore('Untouched', 1, 1, {
            completionRewards: [guaranteed.lotus],
          }),
        },
        {
          content: mystical('Cleared Shrine', 1, {
            completionRewards: [guaranteed.flux, guaranteed.relic],
          }),
        },
        {
          content: mystical('Flux Shrine', 1, {
            completionRewards: [guaranteed.flux],
          }),
        },
        {
          content: mystical('Lucky Shrine', 1, {
            completionRewards: [guaranteed.maybeRelic],
          }),
        },
      ],
      (state) => {
        applyCollectibleGrant(state, relic, 1);
        applyMaterialDelta(state, flux, 1);
      },
    );

    expect(farmableExploreNodes()).toEqual([
      nodes['Beaten'],
      nodes['Cleared Shrine'],
    ]);
  });
});

describe('farmNodeRewardQuantity', () => {
  it('counts what the player holds of each kind of reward', () => {
    const cloak = 'cloak' as EquipmentId;
    seedGamestate((state) => {
      applyMaterialDelta(state, flux, 7);
      applyCollectibleGrant(state, relic, 3);
      state.armory = [
        buildEquipmentItem(cloak),
        buildEquipmentItem('other' as EquipmentId),
        buildEquipmentItem(cloak),
      ];
      state.discoveredRecipes['known' as RecipeId] = { foundAt: 1 };
      state.discoveredWorkers['rescued' as WorkerId] = { foundAt: 1 };
    });

    expect(farmNodeRewardQuantity({ itemId: flux })).toBe(7);
    expect(farmNodeRewardQuantity({ collectibleId: relic })).toBe(3);
    expect(farmNodeRewardQuantity({ equipmentId: cloak })).toBe(2);
    expect(farmNodeRewardQuantity({ recipeId: 'known' as RecipeId })).toBe(1);
    expect(farmNodeRewardQuantity({ recipeId: 'unknown' as RecipeId })).toBe(0);
    expect(farmNodeRewardQuantity({ workerId: 'rescued' as WorkerId })).toBe(1);
    expect(farmNodeRewardQuantity({ workerId: 'lost' as WorkerId })).toBe(0);
  });
});
