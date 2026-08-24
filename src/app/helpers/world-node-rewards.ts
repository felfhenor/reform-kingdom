import { isEquipmentDiscovered } from '@helpers/armory';
import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntry } from '@helpers/content';
import { isMaterialDiscovered } from '@helpers/materials';
import {
  isRecipeDiscovered,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/recipes';
import { isFirstTimeNodeRewardsGranted } from '@helpers/world-node-first-time-rewards';
import {
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
} from '@helpers/world-nodes';
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

// Stable identity string for de-duping rewards; takes RewardIdentity so callers with only an id (no odds/quantity) can use it too.
export function rewardKey(reward: RewardIdentity): string {
  if ('itemId' in reward) return `item:${reward.itemId}`;
  if ('equipmentId' in reward) return `equipment:${reward.equipmentId}`;
  if ('recipeId' in reward) return `recipe:${reward.recipeId}`;
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
  if ('itemId' in reward) return isMaterialDiscovered(reward.itemId);
  if ('equipmentId' in reward) return isEquipmentDiscovered(reward.equipmentId);
  if ('recipeId' in reward) return isRecipeDiscovered(reward.recipeId);
  return isCollectibleDiscovered(reward.collectibleId);
}

// RP-only by authoring convention (enforced by the researchrpgaps
// validator), so there's at most one meaningful entry - the UI only ever
// needs the first.
export function worldNodeFirstTimeReward(
  entry: WorldNodeEntry,
): DroppedReward | undefined {
  const rewards =
    worldNodeEncounter(entry)?.firstTimeRewards ??
    worldNodeGathering(entry)?.firstTimeRewards ??
    worldNodeEncounterRandom(entry)?.firstTimeRewards;
  return rewards?.[0];
}

function nodeHasFirstTimeRewards(entry: WorldNodeEntry): boolean {
  return !!worldNodeFirstTimeReward(entry);
}

// Obtained/total counts for the "X/Y Rewards" info-popup badge. Folds in one
// pseudo-slot for the node's first-time reward (if it has one) using the
// per-node ledger, not isRewardDiscovered's global-discovery check - that
// check is wrong here, since Insight Crystal is a real material and
// isMaterialDiscovered would go true globally after the player's first pickup
// on ANY node, incorrectly marking every other node's first-time reward
// "already obtained". This same counter also drives
// decree-evaluation.ts's nearestUnfinishedExploreNode "unfinished" check, so
// a node with an unclaimed first-time reward gets auto-mode-prioritized for
// free - no separate decree-clause logic needed.
export function worldNodeCompletionRewardProgress(
  entry: WorldNodeEntry,
): WorldNodeCompletionRewardProgress {
  const rewards = worldNodeCompletionRewards(entry);
  const hasFirstTimeReward = nodeHasFirstTimeRewards(entry);

  return {
    obtained:
      rewards.filter(isRewardDiscovered).length +
      (hasFirstTimeReward && isFirstTimeNodeRewardsGranted(entry.nodeName)
        ? 1
        : 0),
    total: rewards.length + (hasFirstTimeReward ? 1 : 0),
  };
}
