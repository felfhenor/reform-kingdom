import { armoryGet } from '@helpers/armory';
import { getCollectibleQuantity } from '@helpers/collectibles';
import { getEntry } from '@helpers/content';
import { getMaterialQuantity } from '@helpers/materials';
import { isRecipeDiscovered } from '@helpers/recipes';
import {
  worldNodeLevelLabel,
  worldNodeLevelRange,
} from '@helpers/world-node-status';
import {
  isGoldCoinReward,
  isRewardDiscovered,
  rewardContentInfo,
  rewardKey,
  worldNodeCompletionRewardProgress,
  worldNodeCompletionRewards,
} from '@helpers/world-node-rewards';
import {
  worldNodeByName,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodesOfType,
} from '@helpers/world-nodes';
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

// Discovered kill drops from every monster fought at `entry`, de-duplicated
// by reward identity. Undiscovered drops are excluded - a reward the player
// hasn't seen yet has no known name/sprite to farm toward, mirroring how the
// bestiary hides undiscovered drops (see `isRewardDiscovered`). Gold Coin is
// excluded too, matching `worldNodeCompletionRewards` - it isn't tracked as
// a "reward" for farming purposes.
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

// The rewards a Farm Node clause could target at `nodeName` - every
// completion reward the node's encounter can grant, plus every discovered
// kill drop from the monsters fought there, resolved to display info and
// de-duplicated by reward identity. The data source for the Farm Node
// clause's reward picker. Excludes recipe rewards - a recipe can only ever
// drop once (it's a boolean unlock, not something you accumulate), so "farm
// until you have N of it" never makes sense for one.
export function farmNodeRewardOptions(nodeName: string): FarmNodeRewardOption[] {
  const entry = worldNodeByName(nodeName);
  if (!entry) return [];

  const rewards = [
    ...worldNodeCompletionRewards(entry),
    ...worldNodeMonsterDrops(entry),
  ];

  const seen = new Set<string>();

  return rewards
    .filter((reward) => !('recipeId' in reward))
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
