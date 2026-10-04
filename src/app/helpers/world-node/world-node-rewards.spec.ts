import type {
  CollectibleId,
  DroppedReward,
  IsContentItem,
  EquipmentId,
  ItemId,
  RecipeId,
  TradeskillId,
  WorldNodeEntry,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import { recipeStylizedName } from '@helpers/crafting/recipes';
import { defaultTradeskillBuilding } from '@helpers/defaults';
import {
  rewardContentInfo,
  worldNodeCompletionRewardProgress,
  worldNodeCompletionRewards,
  worldNodeObtainableMissingRewards,
} from '@helpers/world-node/world-node-rewards';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const nodeName = 'Forest Ruins';

const bone = ensureItem({ id: 'bone' as ItemId, name: 'Bone', sprite: '0001' });
const clam = ensureCollectible({
  id: 'swamp-clam' as CollectibleId,
  name: 'Swamp Clam',
  sprite: '0003',
});
const cloak = ensureEquipment({
  id: 'bone-hewn-cloak' as EquipmentId,
  name: 'Bone-Hewn Cloak',
  sprite: '0002',
});
const tradeskillId = 'tailoring-id' as TradeskillId;
const cloakRecipe = ensureRecipe({
  id: 'equipment-bone-hewn-cloak' as RecipeId,
  name: 'Equipment: Bone-Hewn Cloak',
  tradeskillId,
  minTradeskillLevel: 5,
  result: { equipmentId: cloak.id },
});

function node(): WorldNodeEntry {
  return seedWorldNodes([{ name: nodeName, type: 'ExploreNode' }])[nodeName];
}

function seedEncounterWith(
  completionRewards: DroppedReward[],
  content: IsContentItem[] = [],
): void {
  seedContent([
    ...content,
    ensureEncounter({ name: nodeName, completionRewards }),
  ]);
}

describe('worldNodeCompletionRewards', () => {
  it('excludes Gold Coin and de-dupes rewards by identity', () => {
    const goldCoin = ensureItem({
      id: 'gold-coin' as ItemId,
      name: 'Gold Coin',
    });
    const boneReward = ensureDroppedReward({ itemId: bone.id, chance: 100 });
    const clamReward = ensureDroppedReward({
      collectibleId: clam.id,
      chance: 50,
    });
    seedEncounterWith(
      [
        ensureDroppedReward({ itemId: goldCoin.id, chance: 100 }),
        boneReward,
        ensureDroppedReward({ itemId: bone.id, chance: 50 }),
        clamReward,
      ],
      [goldCoin, bone, clam],
    );

    expect(worldNodeCompletionRewards(node())).toEqual([
      boneReward,
      clamReward,
    ]);
  });

  it('returns an empty array when there is no matching encounter', () => {
    expect(worldNodeCompletionRewards(node())).toEqual([]);
  });

  it('includes recipe rewards alongside the other reward types', () => {
    const recipeReward = ensureDroppedReward({
      recipeId: cloakRecipe.id,
      chance: 25,
    });
    seedEncounterWith([recipeReward], [cloakRecipe]);

    expect(worldNodeCompletionRewards(node())).toEqual([recipeReward]);
  });
});

describe('worldNodeCompletionRewardProgress', () => {
  it('reports 0/total when nothing has been discovered yet', () => {
    seedEncounterWith(
      [
        ensureDroppedReward({ itemId: bone.id, chance: 100 }),
        ensureDroppedReward({ equipmentId: cloak.id, chance: 10 }),
      ],
      [bone, cloak],
    );

    expect(worldNodeCompletionRewardProgress(node())).toEqual({
      obtained: 0,
      total: 2,
    });
  });

  it('counts the rewards already discovered', () => {
    seedEncounterWith(
      [
        ensureDroppedReward({ itemId: bone.id, chance: 100 }),
        ensureDroppedReward({ equipmentId: cloak.id, chance: 10 }),
      ],
      [bone, cloak],
    );
    seedGamestate(
      (state) => (state.discoveredMaterials[bone.id] = { foundAt: 1 }),
    );

    expect(worldNodeCompletionRewardProgress(node())).toEqual({
      obtained: 1,
      total: 2,
    });
  });

  it('reports 0/0 when there is no matching encounter', () => {
    expect(worldNodeCompletionRewardProgress(node())).toEqual({
      obtained: 0,
      total: 0,
    });
  });
});

describe('worldNodeObtainableMissingRewards', () => {
  const clamReward = ensureDroppedReward({
    collectibleId: clam.id,
    chance: 10,
  });

  function withTailoringLevel(level: number, recipeFound = false): void {
    seedGamestate((state) => {
      state.tradeskills[tradeskillId] = {
        ...defaultTradeskillBuilding(),
        level,
      };
      if (recipeFound) state.discoveredRecipes[cloakRecipe.id] = { foundAt: 1 };
    });
  }

  beforeEach(() => {
    seedEncounterWith(
      [
        ensureDroppedReward({ recipeId: cloakRecipe.id, chance: 10 }),
        clamReward,
      ],
      [cloakRecipe, clam],
    );
  });

  it('skips a recipe the tradeskill is too low to drop', () => {
    withTailoringLevel(cloakRecipe.minTradeskillLevel - 1);

    expect(worldNodeObtainableMissingRewards(node())).toEqual([clamReward]);
  });

  it('includes the recipe once the tradeskill level is met', () => {
    withTailoringLevel(cloakRecipe.minTradeskillLevel);

    expect(worldNodeObtainableMissingRewards(node())).toHaveLength(2);
  });

  it('skips rewards already discovered', () => {
    withTailoringLevel(cloakRecipe.minTradeskillLevel, true);

    expect(worldNodeObtainableMissingRewards(node())).toEqual([clamReward]);
  });
});

describe('rewardContentInfo', () => {
  it('resolves an item reward', () => {
    seedContent([bone]);

    expect(rewardContentInfo({ itemId: bone.id })).toEqual({
      name: bone.name,
      sprite: bone.sprite,
      spritesheet: 'item',
    });
  });

  it('resolves an equipment reward', () => {
    seedContent([cloak]);

    expect(rewardContentInfo({ equipmentId: cloak.id })).toEqual({
      name: cloak.name,
      sprite: cloak.sprite,
      spritesheet: 'equipment',
    });
  });

  it('resolves a collectible reward', () => {
    seedContent([clam]);

    expect(rewardContentInfo({ collectibleId: clam.id })).toEqual({
      name: clam.name,
      sprite: clam.sprite,
      spritesheet: 'collectible',
    });
  });

  it("resolves a recipe reward using the recipe's own name, but the crafted result's icon", () => {
    seedContent([
      cloak,
      cloakRecipe,
      ensureTradeskill({ id: tradeskillId, name: 'Tailoring' }),
    ]);

    expect(rewardContentInfo({ recipeId: cloakRecipe.id })).toEqual({
      name: recipeStylizedName(cloakRecipe),
      sprite: cloak.sprite,
      spritesheet: 'equipment',
    });
  });

  it('returns undefined when the reward has no matching content', () => {
    expect(rewardContentInfo({ itemId: 'unknown' as ItemId })).toBeUndefined();
  });
});
