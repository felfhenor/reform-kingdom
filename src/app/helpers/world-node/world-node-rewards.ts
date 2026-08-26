import { getEntry } from '@helpers/content';
import {
  isRecipeDiscovered,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { assertNeverReward } from '@helpers/item/loot';
import { isMaterialDiscovered } from '@helpers/item/materials';
import { isEquipmentDiscovered } from '@helpers/kingdom/armory';
import { isWorkerRescued } from '@helpers/worker/worker-discovery';
import {
  worldNodeEncounter,
  worldNodeEncounterRandom,
} from '@helpers/world-node/world-nodes';
import type {
  CollectibleContent,
  DroppedReward,
  EquipmentContent,
  ItemContent,
  RecipeContent,
  RewardContentInfo,
  RewardIdentity,
  WorkerContent,
  WorldNodeCompletionRewardProgress,
  WorldNodeEntry,
} from '@interfaces';

// Stable de-dupe key. `RewardIdentity` has no `kind` (it also stores a persisted
// Decree clause target, so it stays a minimal bare-id shape) - structural `in` checks, not a switch.
export function rewardKey(reward: RewardIdentity): string {
  if ('itemId' in reward) return `item:${reward.itemId}`;
  if ('equipmentId' in reward) return `equipment:${reward.equipmentId}`;
  if ('recipeId' in reward) return `recipe:${reward.recipeId}`;
  if ('workerId' in reward) return `worker:${reward.workerId}`;
  return `collectible:${reward.collectibleId}`;
}

// Resolves a reward to displayable icon/name content, without discovery-gating or drop odds.
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
      ? {
          name: equipment.name,
          sprite: equipment.sprite,
          spritesheet: 'equipment',
        }
      : undefined;
  }

  if ('collectibleId' in reward) {
    const collectible = getEntry<CollectibleContent>(reward.collectibleId);
    return collectible
      ? {
          name: collectible.name,
          sprite: collectible.sprite,
          spritesheet: 'collectible',
        }
      : undefined;
  }

  if ('workerId' in reward) {
    const worker = getEntry<WorkerContent>(reward.workerId);
    return worker
      ? { name: worker.name, sprite: worker.sprite, spritesheet: 'worker' }
      : undefined;
  }

  const recipe = getEntry<RecipeContent>(reward.recipeId);
  if (!recipe) return undefined;

  // Use the recipe's own name (it grants the blueprint, not the item) but the result's sprite, since recipes have no icon.
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

// Distinct completion rewards, excluding Gold Coin and de-duplicated by identity.
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
  switch (reward.kind) {
    case 'Item':
      return isMaterialDiscovered(reward.itemId);
    case 'Equipment':
      return isEquipmentDiscovered(reward.equipmentId);
    case 'Recipe':
      return isRecipeDiscovered(reward.recipeId);
    case 'Worker':
      return isWorkerRescued(reward.workerId);
    case 'Collectible':
      return isCollectibleDiscovered(reward.collectibleId);
    default:
      return assertNeverReward(reward);
  }
}

// Obtained/total counts for the "X/Y Rewards" info-popup badge.
export function worldNodeCompletionRewardProgress(
  entry: WorldNodeEntry,
): WorldNodeCompletionRewardProgress {
  const rewards = worldNodeCompletionRewards(entry);

  return {
    obtained: rewards.filter(isRewardDiscovered).length,
    total: rewards.length,
  };
}
