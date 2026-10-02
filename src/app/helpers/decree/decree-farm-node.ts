import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import { getCollectibleQuantity } from '@helpers/item/collectibles';
import { isClearProofReward } from '@helpers/item/loot';
import { getMaterialQuantity } from '@helpers/item/materials';
import { armoryGet } from '@helpers/kingdom/armory';
import { isWorkerRescued } from '@helpers/worker/worker-discovery';
import {
  isRewardDiscovered,
  worldNodeCompletionRewardProgress,
  worldNodeCompletionRewards,
} from '@helpers/world-node/world-node-rewards';
import { worldNodesOfType } from '@helpers/world-node/world-nodes';
import type { RewardIdentity, WorldNodeEntry } from '@interfaces';

// Mystical nodes all share common rewards (e.g. Duskhall Flux, also sold by caravans), so they need a node-unique reward as proof.
function isExploreRandomNodeCleared(entry: WorldNodeEntry): boolean {
  return worldNodeCompletionRewards(entry).some(
    (reward) => isClearProofReward(reward) && isRewardDiscovered(reward),
  );
}

// ExploreNodes with at least one completion reward looted - the closest proxy to "already beaten" this game has.
export function farmableExploreNodes(): WorldNodeEntry[] {
  return [
    ...worldNodesOfType('ExploreNode').filter(
      (entry) => worldNodeCompletionRewardProgress(entry).obtained > 0,
    ),
    ...worldNodesOfType('ExploreRandomNode').filter(isExploreRandomNodeCleared),
  ];
}

// Current stock of `reward`, generalized across all reward types. Equipment has no quantity field so it's counted from owned armory entries; recipes read as 1/0 (known or not).
// Workers read the same way (1/0 rescued or not) - unreachable in practice, kept for type completeness.
export function farmNodeRewardQuantity(reward: RewardIdentity): number {
  if ('itemId' in reward) return getMaterialQuantity(reward.itemId);

  if ('equipmentId' in reward) {
    return armoryGet().filter((item) => item.equipmentId === reward.equipmentId)
      .length;
  }

  if ('collectibleId' in reward) {
    return getCollectibleQuantity(reward.collectibleId);
  }

  if ('workerId' in reward) return isWorkerRescued(reward.workerId) ? 1 : 0;

  return isRecipeDiscovered(reward.recipeId) ? 1 : 0;
}
