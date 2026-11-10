import { farmableExploreNodes } from '@helpers/decree/decree-farm-node';
import { assertNeverReward } from '@helpers/item/loot';
import { worldNodeMonsterDropTable } from '@helpers/world-node/world-node-monster-drops';
import {
  isGoldCoinReward,
  isRewardDiscovered,
  rewardContentInfo,
  rewardKey,
  worldNodeCompletionRewards,
} from '@helpers/world-node/world-node-rewards';
import { worldNodeFarmOption } from '@helpers/world-node/world-node-status.ui';
import {
  worldNodeByName,
  worldNodeEncounterRandom,
} from '@helpers/world-node/world-nodes';
import {
  type DroppedReward,
  type ExploreNodeFarmOption,
  type FarmNodeRewardOption,
  type RewardIdentity,
  type WorldNodeEntry,
} from '@interfaces';
import { sortBy, uniqBy } from 'es-toolkit/compat';

export function farmNodeActiveWarning(nodeName: string): string | undefined {
  const entry = worldNodeByName(nodeName);
  if (!entry || !worldNodeEncounterRandom(entry)) return undefined;

  return 'This is a mystical location, it will only be visited while it is active.';
}

export function exploreNodeFarmOptions(): ExploreNodeFarmOption[] {
  return sortBy(
    farmableExploreNodes().map(worldNodeFarmOption),
    (option) => option.nodeName,
  );
}

function toRewardIdentity(reward: DroppedReward): RewardIdentity {
  switch (reward.kind) {
    case 'Item':
      return { itemId: reward.itemId };
    case 'Equipment':
      return { equipmentId: reward.equipmentId };
    case 'Collectible':
      return { collectibleId: reward.collectibleId };
    case 'Worker':
      return { workerId: reward.workerId };
    case 'Recipe':
      return { recipeId: reward.recipeId };
    default:
      return assertNeverReward(reward);
  }
}

// Discovered kill drops from every monster fought at `entry`, de-duplicated; excludes undiscovered drops and Gold Coin.
function worldNodeMonsterDrops(entry: WorldNodeEntry): DroppedReward[] {
  return uniqBy(
    worldNodeMonsterDropTable(entry, true).filter(
      (reward) => !isGoldCoinReward(reward) && isRewardDiscovered(reward),
    ),
    (reward) => rewardKey(reward),
  );
}

export function farmNodeRewardOptions(
  nodeName: string,
): FarmNodeRewardOption[] {
  const entry = worldNodeByName(nodeName);
  if (!entry) return [];

  const rewards = [
    ...worldNodeCompletionRewards(entry),
    ...worldNodeMonsterDrops(entry),
  ];

  const seen = new Set<string>();

  // Recipes and workers are excluded: both are one-time unlocks, not
  // something to accumulate/farm a quantity of.
  return rewards
    .filter((reward) => !('recipeId' in reward) && !('workerId' in reward))
    .map((reward) => {
      const identity = toRewardIdentity(reward);
      const key = rewardKey(identity);
      if (seen.has(key)) return undefined;
      seen.add(key);

      const content = rewardContentInfo(identity);
      if (!content) return undefined;

      return { ...content, key, reward: identity };
    })
    .filter((option): option is FarmNodeRewardOption => !!option);
}

export function farmableRewardOptions(): FarmNodeRewardOption[] {
  const options = farmableExploreNodes().flatMap((entry) =>
    farmNodeRewardOptions(entry.nodeName),
  );
  return sortBy(uniqBy(options, 'key'), 'name');
}

export function exploreNodeFarmOptionsFor(
  key: string,
): ExploreNodeFarmOption[] {
  return exploreNodeFarmOptions().filter((option) =>
    farmNodeRewardOptions(option.nodeName).some((reward) => reward.key === key),
  );
}
