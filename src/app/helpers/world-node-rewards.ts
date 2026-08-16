import { isEquipmentDiscovered } from '@helpers/armory';
import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntry } from '@helpers/content';
import { isMaterialDiscovered } from '@helpers/materials';
import {
  isRecipeDiscovered,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/recipes';
import { worldNodeEncounter, worldNodeEncounterRandom } from '@helpers/world-nodes';
import type {
  CollectibleContent,
  DroppedReward,
  EquipmentContent,
  ItemContent,
  RecipeContent,
  RewardContentInfo,
  RewardIdentity,
  WorldNodeCompletionRewardProgress,
  WorldNodeEntry,
} from '@interfaces';

// A stable identity for a reward, used to de-dupe the preview list below -
// mirrors how `worldNodeGatherMaterialIds` de-dupes by itemId via a `Set`.
// Takes the bare `RewardIdentity` shape rather than a full `DroppedReward` so
// it can also key a reward a caller only has an id for (e.g. a Decree
// clause's stored farm target) - any `DroppedReward` is still accepted,
// since it's structurally a `RewardIdentity` plus extra odds/quantity fields.
export function rewardKey(reward: RewardIdentity): string {
  if ('itemId' in reward) return `item:${reward.itemId}`;
  if ('equipmentId' in reward) return `equipment:${reward.equipmentId}`;
  if ('recipeId' in reward) return `recipe:${reward.recipeId}`;
  return `collectible:${reward.collectibleId}`;
}

// Resolves a reward down to displayable content - the same fields
// `SlotCompletionRewardComponent` shows, minus discovery-gating, for UI that
// needs a reward's icon/name without also needing its drop odds (e.g. the
// Farm Node clause's reward picker and its row/summary display).
export function rewardContentInfo(
  reward: RewardIdentity,
): RewardContentInfo | undefined {
  if ('itemId' in reward) {
    const item = getEntry<ItemContent>(reward.itemId);
    return item
      ? { name: item.name, sprite: item.sprite, spritesheet: 'item' }
      : undefined;
  }

  if ('equipmentId' in reward) {
    const equipment = getEntry<EquipmentContent>(reward.equipmentId);
    return equipment
      ? { name: equipment.name, sprite: equipment.sprite, spritesheet: 'equipment' }
      : undefined;
  }

  if ('collectibleId' in reward) {
    const collectible = getEntry<CollectibleContent>(reward.collectibleId);
    return collectible
      ? { name: collectible.name, sprite: collectible.sprite, spritesheet: 'collectible' }
      : undefined;
  }

  const recipe = getEntry<RecipeContent>(reward.recipeId);
  if (!recipe) return undefined;

  // The recipe's own name (not its crafted result's) - a recipe reward
  // grants the blueprint, not the item, and recipe names already carry a
  // "Category: Item" naming convention (e.g. "Equipment: Bone-Hewn Cloak")
  // that calls this out. Sprite/spritesheet still borrow the result, since a
  // recipe has no icon of its own.
  const result = recipeResultContent(recipe);
  return result
    ? {
        name: recipe.name,
        sprite: result.sprite,
        spritesheet: recipeResultSpritesheet(recipe),
      }
    : undefined;
}

export function isGoldCoinReward(reward: DroppedReward): boolean {
  if (!('itemId' in reward)) return false;
  return reward.itemId === getEntry<ItemContent>('Gold Coin')?.id;
}

// The distinct completion rewards an encounter can grant, excluding Gold
// Coin (which isn't tracked as a "reward" for discovery/preview purposes)
// and de-duplicated by reward identity.
export function worldNodeCompletionRewards(
  entry: WorldNodeEntry,
): DroppedReward[] {
  const completionRewards =
    worldNodeEncounter(entry)?.completionRewards ??
    worldNodeEncounterRandom(entry)?.completionRewards;
  if (!completionRewards) return [];

  const seen = new Set<string>();
  const rewards: DroppedReward[] = [];

  completionRewards.forEach((reward) => {
    if (isGoldCoinReward(reward)) return;

    const key = rewardKey(reward);
    if (seen.has(key)) return;

    seen.add(key);
    rewards.push(reward);
  });

  return rewards;
}

export function isRewardDiscovered(reward: DroppedReward): boolean {
  if ('itemId' in reward) return isMaterialDiscovered(reward.itemId);
  if ('equipmentId' in reward) return isEquipmentDiscovered(reward.equipmentId);
  if ('recipeId' in reward) return isRecipeDiscovered(reward.recipeId);
  return isCollectibleDiscovered(reward.collectibleId);
}

// How many of an encounter's completion rewards the player has ever
// obtained, out of the total - used for the "X/Y Rewards" info-popup badge.
export function worldNodeCompletionRewardProgress(
  entry: WorldNodeEntry,
): WorldNodeCompletionRewardProgress {
  const rewards = worldNodeCompletionRewards(entry);

  return {
    obtained: rewards.filter(isRewardDiscovered).length,
    total: rewards.length,
  };
}
