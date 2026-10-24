import { getEntriesByType, getEntry } from '@helpers/content/content';
import { rangeLabelAtLevel } from '@helpers/engine/leveled-range';
import { rewardDisplayOrder } from '@helpers/item/loot';
import {
  getMonsterFoundAtNodes,
  getMonsterKillCount,
  getMonsterLevelRangeFound,
  isMonsterDiscovered,
  monsterSourceNodeNames,
} from '@helpers/kingdom/bestiary';
import { townGuardianMonsterIds } from '@helpers/town/town-guardian';
import {
  isRewardDiscovered,
  rewardContentInfo,
} from '@helpers/world-node/world-node-rewards';
import { worldNodeDisplayName } from '@helpers/world-node/world-nodes';
import type {
  BestiaryEntry,
  DroppedReward,
  EncounterContent,
  MonsterContent,
} from '@interfaces';
import { orderBy, range, sortBy, uniq } from 'es-toolkit/compat';

// Item drops roll a level-scaled quantity range; other reward types are always a flat chance for one.
export function bestiaryDropQuantityLabel(
  reward: DroppedReward,
  level: number,
): string {
  if (!('itemId' in reward)) return 'x1';

  return 'x' + rangeLabelAtLevel(reward, level);
}

// The XP a kill at this level grants, formatted as a single number, or a "min-max" range.
export function bestiaryXpLabel(
  monster: MonsterContent,
  level: number,
): string {
  return rangeLabelAtLevel(monster.xp, level);
}

export function bestiaryEntry(monster: MonsterContent): BestiaryEntry {
  return {
    monster,
    discovered: isMonsterDiscovered(monster.id),
    kills: getMonsterKillCount(monster.id),
    levelRange: getMonsterLevelRangeFound(monster.id),
    foundAtNodes: getMonsterFoundAtNodes(monster.id).map(worldNodeDisplayName),
    sourceNodeNames: monsterSourceNodeNames(monster.id).map(
      worldNodeDisplayName,
    ),
    drops: sortBy(monster.drops, [rewardDisplayOrder]).map((reward) => ({
      reward,
      discovered: isRewardDiscovered(reward),
    })),
  };
}

function bestiarySourceNodes(entry: BestiaryEntry): EncounterContent[] {
  return entry.sourceNodeNames
    .map((name) => getEntry<EncounterContent>(name))
    .filter((node): node is EncounterContent => !!node);
}

// Every level the monster can be met at, across all the nodes it spawns in.
export function bestiaryEntryLevels(entry: BestiaryEntry): number[] {
  return sortBy(
    uniq(
      bestiarySourceNodes(entry).flatMap(({ levelRange }) =>
        range(levelRange.min, levelRange.max + 1),
      ),
    ),
  );
}

// Without a level, every node it spawns in.
export function bestiarySourceNodeNamesAtLevel(
  entry: BestiaryEntry,
  level?: number,
): string[] {
  return bestiarySourceNodes(entry)
    .filter(
      ({ levelRange }) =>
        level === undefined ||
        (level >= levelRange.min && level <= levelRange.max),
    )
    .map((node) => node.name);
}

// Undiscovered monsters are still returned so the bestiary can render them as silhouettes instead of omitting them.
export function getBestiaryEntries(): BestiaryEntry[] {
  const guardianMonsterIds = new Set(townGuardianMonsterIds());
  const monsters = getEntriesByType<MonsterContent>('monster').filter(
    (monster) => !guardianMonsterIds.has(monster.id),
  );

  return orderBy(
    monsters.map(bestiaryEntry),
    [(entry) => (entry.discovered ? 1 : 0), (entry) => entry.monster.name],
    ['desc', 'asc'],
  );
}

// Undiscovered ("???") entries never match a search - unlike the museum, bestiary search can't hint at an unkilled monster.
export function filterBestiaryEntries(
  entries: BestiaryEntry[],
  searchText: string,
): BestiaryEntry[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) => {
    if (!entry.discovered) return false;

    if (entry.monster.name.toLowerCase().includes(text)) return true;
    if (entry.foundAtNodes.some((name) => name.toLowerCase().includes(text))) {
      return true;
    }

    return entry.drops.some((drop) => {
      if (!drop.discovered) return false;
      const content = rewardContentInfo(drop.reward);
      return content ? content.name.toLowerCase().includes(text) : false;
    });
  });
}
