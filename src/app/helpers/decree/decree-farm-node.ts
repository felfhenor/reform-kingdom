import { getEntry } from '@helpers/content';
import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import { getCollectibleQuantity } from '@helpers/item/collectibles';
import { assertNeverReward } from '@helpers/item/loot';
import { getMaterialQuantity } from '@helpers/item/materials';
import { armoryGet } from '@helpers/kingdom/armory';
import { isWorkerRescued } from '@helpers/worker/worker-discovery';
import {
  isGoldCoinReward,
  isRewardDiscovered,
  rewardContentInfo,
  rewardKey,
  worldNodeCompletionRewardProgress,
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
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  DroppedReward,
  ExploreNodeFarmOption,
  FarmNodeRewardOption,
  MonsterContent,
  MonsterId,
  RewardIdentity,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// ExploreNodes with at least one completion reward looted - the closest proxy to "already beaten" this game has.
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

// Strips a reward down to its bare identity, dropping the drop-table odds/quantity fields.
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

// Every monster fought at `entry`'s encounter - a static fight list for an
// Encounter, or the creature pool for an EncounterRandom.
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
  const monsterIds = new Set(worldNodeMonsterIds(entry));

  const seen = new Set<string>();
  const drops: DroppedReward[] = [];

  monsterIds.forEach((monsterId) => {
    const monster = getEntry<MonsterContent>(monsterId);
    monster?.drops.forEach((reward) => {
      if (isGoldCoinReward(reward)) return;
      if (!isRewardDiscovered(reward)) return;

      const key = rewardKey(reward);
      if (seen.has(key)) return;

      seen.add(key);
      drops.push(reward);
    });
  });

  return drops;
}

// Completion rewards plus discovered kill drops for `nodeName`, de-duplicated. Excludes recipes since they're a one-time unlock, not something to accumulate.
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

// Current stock of `reward`, generalized across all reward types. Equipment has no quantity field so it's counted from owned armory entries; recipes read as 1/0 (known or not).
// Workers read the same way (1/0 rescued or not) - unreachable in practice
// since farmNodeRewardOptions excludes them, kept for type completeness.
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
