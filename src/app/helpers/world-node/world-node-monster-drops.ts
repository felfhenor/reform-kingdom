import { CHARACTER_MAX_LEVEL } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { globalEffectSumsState } from '@helpers/state-game';
import { worldNodeDevelopmentMaxLevel } from '@helpers/world-node/world-node-development';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevelRange } from '@helpers/world-node/world-node-status';
import {
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  DroppedItemReward,
  DroppedReward,
  MonsterContent,
  MonsterId,
  WorldNodeEntry,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

export function worldNodeMonsterIds(entry: WorldNodeEntry): MonsterId[] {
  const encounter = worldNodeEncounter(entry);
  if (encounter) {
    return encounter.fights.flatMap((fight) =>
      fight.monsters.map((monster) => monster.monsterId),
    );
  }

  const encounterRandom = worldNodeEncounterRandom(entry);
  return encounterRandom?.creaturePool.map((pool) => pool.monsterId) ?? [];
}

// The map's gather tables at max development, as drop rows whose chances split the effect's percent by weight.
export function regionGatheringDrops(mapName: string): DroppedItemReward[] {
  const dropChance = globalEffectSumsState().regionGatheringDropChance;
  if (dropChance <= 0) return [];

  const results = worldNodesOfType('GatherNode')
    .filter((entry) => entry.mapName === mapName)
    .flatMap((entry) => {
      const gathering = worldNodeGathering(entry);
      return gathering
        ? gatheringResultsAtLevel(
            gathering,
            worldNodeDevelopmentMaxLevel(gathering),
          )
        : [];
    });
  const totalWeight = sumBy(results, (result) => result.chance);
  if (totalWeight <= 0) return [];

  // Whole percents, since drops roll a whole number against the chance.
  return results.flatMap((result) =>
    result.items.map((item) => ({
      kind: 'Item' as const,
      itemId: item.itemId,
      min: item.quantity,
      max: item.quantity,
      minLevel: 0,
      maxLevel: CHARACTER_MAX_LEVEL,
      chance: Math.max(
        1,
        Math.round((dropChance * result.chance) / totalWeight),
      ),
    })),
  );
}

export function monsterDropsOnMap(
  monster: MonsterContent,
  mapName: string,
): DroppedReward[] {
  return [...monster.drops, ...regionGatheringDrops(mapName)];
}

// One row per monster drop that can roll at this node's level - not de-duplicated, so per-monster odds survive.
export function worldNodeMonsterDropTable(
  entry: WorldNodeEntry,
  withRegionDrops: boolean,
): DroppedReward[] {
  const levelRange = worldNodeLevelRange(entry);
  if (!levelRange) return [];

  const regionDrops = withRegionDrops
    ? regionGatheringDrops(entry.mapName)
    : [];
  return [...new Set(worldNodeMonsterIds(entry))].flatMap((monsterId) => {
    const monster = getEntry<MonsterContent>(monsterId);
    if (!monster) return [];

    return [...monster.drops, ...regionDrops].filter(
      (reward) =>
        levelRange.max >= reward.minLevel && levelRange.min <= reward.maxLevel,
    );
  });
}
