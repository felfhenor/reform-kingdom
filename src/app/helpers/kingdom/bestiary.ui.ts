import { getEntriesByType } from '@helpers/content/content';
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
import type { BestiaryEntry, DroppedReward, MonsterContent } from '@interfaces';
import { orderBy, sortBy } from 'es-toolkit/compat';

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

// Undiscovered monsters are still returned so the bestiary can render them as silhouettes instead of omitting them.
export function getBestiaryEntries(): BestiaryEntry[] {
  const guardianMonsterIds = new Set(townGuardianMonsterIds());
  const monsters = getEntriesByType<MonsterContent>('monster').filter(
    (monster) => !guardianMonsterIds.has(monster.id),
  );

  const entries = monsters.map((monster) => {
    const discovered = isMonsterDiscovered(monster.id);

    return {
      monster,
      discovered,
      kills: getMonsterKillCount(monster.id),
      levelRange: getMonsterLevelRangeFound(monster.id),
      foundAtNodes: getMonsterFoundAtNodes(monster.id).map(
        worldNodeDisplayName,
      ),
      sourceNodeNames: monsterSourceNodeNames(monster.id).map(
        worldNodeDisplayName,
      ),
      drops: sortBy(monster.drops, [rewardDisplayOrder]).map((reward) => ({
        reward,
        discovered: isRewardDiscovered(reward),
      })),
    };
  });

  return orderBy(
    entries,
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
