import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/analytics';
import { getEntriesByType, getEntry } from '@helpers/content';
import { rangeLabelAtLevel } from '@helpers/leveled-range';
import { rewardDisplayOrder } from '@helpers/loot';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  isRewardDiscovered,
  rewardContentInfo,
} from '@helpers/world-node-rewards';
import { worldNodeDisplayName } from '@helpers/world-nodes';
import type {
  BestiaryEntry,
  DroppedReward,
  EncounterContent,
  EncounterRandomContent,
  GameStateBestiary,
  LevelRange,
  MonsterContent,
  MonsterId,
} from '@interfaces';
import { orderBy, sortBy } from 'es-toolkit/compat';

export function isMonsterDiscovered(monsterId: MonsterId): boolean {
  return !!gamestate().bestiary[monsterId]?.foundAt;
}

export function getMonsterKillCount(monsterId: MonsterId): number {
  return gamestate().bestiary[monsterId]?.kills ?? 0;
}

export function getMonsterFoundAtNodes(monsterId: MonsterId): string[] {
  return gamestate().bestiary[monsterId]?.foundAtNodes ?? [];
}

// The actual min/max level the party has fought this monster at -
// undefined until it's been killed at least once.
export function getMonsterLevelRangeFound(
  monsterId: MonsterId,
): LevelRange | undefined {
  const entry = gamestate().bestiary[monsterId];
  if (!entry) return undefined;

  return { min: entry.minLevelFound, max: entry.maxLevelFound };
}

// First kill marks the monster discovered; later kills fold in level/location. Treats non-finite min/max as unset to avoid NaN poisoning from pre-level-tracking entries.
export function monsterRecordKill(
  monsterId: MonsterId,
  level: number,
  foundAtNode?: string,
): void {
  const alreadyDiscovered = isMonsterDiscovered(monsterId);

  updateGamestate((state) => {
    const existing = state.bestiary[monsterId];
    const foundAtNodes = new Set(existing?.foundAtNodes ?? []);
    if (foundAtNode) foundAtNodes.add(foundAtNode);

    const existingMin = existing?.minLevelFound;
    const existingMax = existing?.maxLevelFound;

    state.bestiary[monsterId] = {
      foundAt: existing?.foundAt ?? Date.now(),
      kills: (existing?.kills ?? 0) + 1,
      minLevelFound: Number.isFinite(existingMin)
        ? Math.min(existingMin as number, level)
        : level,
      maxLevelFound: Number.isFinite(existingMax)
        ? Math.max(existingMax as number, level)
        : level,
      foundAtNodes: [...foundAtNodes],
    };
    return state;
  });

  if (!alreadyDiscovered) {
    const monsterName = getEntry<MonsterContent>(monsterId)?.name;
    if (monsterName) {
      analyticsSendDesignEvent(
        `Progress:Bestiary:Unlock:${analyticsSafeSegment(monsterName)}`,
      );
    }
  }
}

// Repairs entries predating min/max level tracking (see `monsterRecordKill`) by collapsing them to a single unknown level; widens again on the next kill.
export function repairInvalidBestiaryLevels(
  bestiary: GameStateBestiary,
): GameStateBestiary {
  const repaired: GameStateBestiary = {};

  (Object.keys(bestiary) as MonsterId[]).forEach((monsterId) => {
    const entry = bestiary[monsterId];
    const hasValidRange =
      Number.isFinite(entry.minLevelFound) &&
      Number.isFinite(entry.maxLevelFound);

    repaired[monsterId] = hasValidRange
      ? entry
      : { ...entry, minLevelFound: 1, maxLevelFound: 1 };
  });

  return repaired;
}

// Drops any bestiary entries whose monsterId no longer resolves to real
// content - e.g. after a monster is renamed/removed from gamedata.
export function pruneInvalidBestiaryEntries(
  bestiary: GameStateBestiary,
): GameStateBestiary {
  const pruned: GameStateBestiary = {};

  (Object.keys(bestiary) as MonsterId[]).forEach((monsterId) => {
    if (getEntry<MonsterContent>(monsterId)) {
      pruned[monsterId] = bestiary[monsterId];
    }
  });

  return pruned;
}

// Every authored or generated place this monster can be fought - backs the "discoverable in" hint on undiscovered entries.
export function monsterEncounters(
  monsterId: MonsterId,
): Array<EncounterContent | EncounterRandomContent> {
  const encounters = getEntriesByType<EncounterContent>('encounter').filter(
    (encounter) =>
      encounter.fights.some((fight) =>
        fight.monsters.some((entry) => entry.monsterId === monsterId),
      ),
  );

  const randomEncounters = getEntriesByType<EncounterRandomContent>(
    'encounterrandom',
  ).filter((encounter) =>
    encounter.creaturePool.some((pool) => pool.monsterId === monsterId),
  );

  return [...encounters, ...randomEncounters];
}

export function monsterSourceNodeNames(monsterId: MonsterId): string[] {
  return monsterEncounters(monsterId).map((encounter) => encounter.name);
}

// Item drops roll a level-scaled quantity range (via `rangeAtLevel`); other reward types are always a flat chance for one.
export function bestiaryDropQuantityLabel(
  reward: DroppedReward,
  level: number,
): string {
  if (!('itemId' in reward)) return '1';

  return rangeLabelAtLevel(reward, level);
}

// The XP a kill at this level grants, formatted the same way as
// `bestiaryDropQuantityLabel` (a single number, or a "min-max" range).
export function bestiaryXpLabel(
  monster: MonsterContent,
  level: number,
): string {
  return rangeLabelAtLevel(monster.xp, level);
}

// Undiscovered monsters are still returned so the bestiary can render them as silhouettes instead of omitting them.
export function getBestiaryEntries(): BestiaryEntry[] {
  const monsters = getEntriesByType<MonsterContent>('monster');

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
