import { getEntry } from '@helpers/content/content';
import { farmableExploreNodes } from '@helpers/decree/decree-farm-node';
import { assertNeverReward } from '@helpers/item/loot';
import {
  isGoldCoinReward,
  isRewardDiscovered,
  rewardContentInfo,
  rewardKey,
  worldNodeCompletionRewards,
} from '@helpers/world-node/world-node-rewards';
import {
  worldNodeLevelLabel,
  worldNodeLevelRange,
} from '@helpers/world-node/world-node-status';
import {
  worldNodeByName,
  worldNodeEncounter,
  worldNodeEncounterRandom,
} from '@helpers/world-node/world-nodes';
import {
  type DroppedReward,
  type EncounterContent,
  type ExploreNodeFarmOption,
  type FarmNodeRewardOption,
  type MonsterContent,
  type MonsterId,
  type RewardIdentity,
  type WorldNodeEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

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

function worldNodeMonsterIds(entry: WorldNodeEntry): MonsterId[] {
  const encounter = worldNodeEncounter(entry);
  if (encounter) {
    return encounter.fights.flatMap((fight) =>
      fight.monsters.map((monster) => monster.monsterId),
    );
  }

  const encounterRandom = worldNodeEncounterRandom(entry);
  return encounterRandom?.creaturePool.map((pool) => pool.monsterId) ?? [];
}

// Discovered kill drops from every monster fought at `entry`, de-duplicated; excludes undiscovered drops and Gold Coin.
function worldNodeMonsterDrops(entry: WorldNodeEntry): DroppedReward[] {
  const node = getEntry<EncounterContent>(entry.nodeName);
  if (!node) return [];

  const monsterIds = new Set(worldNodeMonsterIds(entry));

  const seen = new Set<string>();
  const drops: DroppedReward[] = [];

  monsterIds.forEach((monsterId) => {
    const monster = getEntry<MonsterContent>(monsterId);
    monster?.drops.forEach((reward) => {
      if (isGoldCoinReward(reward)) return;
      if (!isRewardDiscovered(reward)) return;

      const canDropFromNode =
        node.levelRange.min >= reward.minLevel &&
        node.levelRange.max <= reward.maxLevel;
      if (!canDropFromNode) return;

      const key = rewardKey(reward);
      if (seen.has(key)) return;

      seen.add(key);
      drops.push(reward);
    });
  });

  return drops;
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
