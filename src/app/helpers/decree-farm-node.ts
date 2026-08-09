import { armoryGet } from '@helpers/armory';
import { getCollectibleQuantity } from '@helpers/collectibles';
import { getMaterialQuantity } from '@helpers/materials';
import { isRecipeDiscovered } from '@helpers/recipes';
import {
  rewardContentInfo,
  rewardKey,
  worldNodeByName,
  worldNodeCompletionRewardProgress,
  worldNodeCompletionRewards,
  worldNodeLevelLabel,
  worldNodeLevelRange,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type {
  DroppedReward,
  ExploreNodeFarmOption,
  FarmNodeRewardOption,
  RewardIdentity,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// ExploreNodes the player has looted at least one completion reward from -
// the closest proxy this game has to "already beaten", since ExploreNodes
// themselves carry no discrete discovery/completion flag of their own (see
// `worldNodeCompletionRewardProgress`). The data source for the Farm Node
// clause's node picker.
export function farmableExploreNodes(): WorldNodeEntry[] {
  return worldNodesOfType('ExploreNode').filter(
    (entry) => worldNodeCompletionRewardProgress(entry).obtained > 0,
  );
}

export function exploreNodeFarmOptions(): ExploreNodeFarmOption[] {
  return sortBy(
    farmableExploreNodes().map((entry) => {
      const levelRange = worldNodeLevelRange(entry);
      return {
        nodeName: entry.nodeName,
        levelLabel: levelRange ? worldNodeLevelLabel(levelRange) : '?',
        entry,
      };
    }),
    (option) => option.nodeName,
  );
}

// Strips a reward down to its bare identity - drops the drop-table odds/
// quantity-range fields, which have no bearing on what's being farmed.
function toRewardIdentity(reward: DroppedReward): RewardIdentity {
  if ('itemId' in reward) return { itemId: reward.itemId };
  if ('equipmentId' in reward) return { equipmentId: reward.equipmentId };
  if ('collectibleId' in reward) return { collectibleId: reward.collectibleId };
  return { recipeId: reward.recipeId };
}

// The rewards a Farm Node clause could target at `nodeName` - every
// completion reward the node's encounter can grant, resolved to display
// info. The data source for the Farm Node clause's reward picker. Excludes
// recipe rewards - a recipe can only ever drop once (it's a boolean unlock,
// not something you accumulate), so "farm until you have N of it" never
// makes sense for one.
export function farmNodeRewardOptions(nodeName: string): FarmNodeRewardOption[] {
  const entry = worldNodeByName(nodeName);
  if (!entry) return [];

  return worldNodeCompletionRewards(entry)
    .filter((reward) => !('recipeId' in reward))
    .map((reward) => {
      const content = rewardContentInfo(reward);
      if (!content) return undefined;

      const identity = toRewardIdentity(reward);
      return { ...content, key: rewardKey(identity), reward: identity };
    })
    .filter((option): option is FarmNodeRewardOption => !!option);
}

// How many of `reward` the player currently owns - the same "current stock"
// concept `getMaterialQuantity` gives the GatherMaterial clause, generalized
// across every reward type a node's completion table can grant. Equipment
// has no per-id quantity field (armory items are one entry per physical
// piece, never merged), so it's counted by filtering owned armory entries. A
// recipe is a boolean unlock rather than something stackable, so it reads as
// 1 once known and 0 until then.
export function farmNodeRewardQuantity(reward: RewardIdentity): number {
  if ('itemId' in reward) return getMaterialQuantity(reward.itemId);

  if ('equipmentId' in reward) {
    return armoryGet().filter((item) => item.equipmentId === reward.equipmentId)
      .length;
  }

  if ('collectibleId' in reward) {
    return getCollectibleQuantity(reward.collectibleId);
  }

  return isRecipeDiscovered(reward.recipeId) ? 1 : 0;
}
