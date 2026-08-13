import { getEntriesByType, getEntry } from '@helpers/content';
import { rangeLabelAtLevel } from '@helpers/leveled-range';
import { rewardDisplayOrder } from '@helpers/loot';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { isRewardDiscovered, rewardContentInfo } from '@helpers/world-node-rewards';
import { worldNodeDisplayName } from '@helpers/world-nodes';
import type {
  BestiaryEntry,
  DroppedReward,
  EncounterContent,
  EncounterLevelRange,
  EncounterRandomContent,
  GameStateBestiary,
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
): EncounterLevelRange | undefined {
  const entry = gamestate().bestiary[monsterId];
  if (!entry) return undefined;

  return { min: entry.minLevelFound, max: entry.maxLevelFound };
}

// Records a monster kill - the first kill also marks it discovered for the
// bestiary; every kill after that just increments the running counter, folds
// the kill's level into the found min/max, and accumulates the location
// into the set of every place it's been found. Guards against a corrupt or
// pre-level-tracking existing entry (an unset `minLevelFound`/`maxLevelFound`
// would otherwise poison every future kill via `Math.min`/`Math.max` with
// NaN) by treating anything non-finite as unset.
export function monsterRecordKill(
  monsterId: MonsterId,
  level: number,
  foundAtNode?: string,
): void {
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
}

// Repairs bestiary entries written before min/max level tracking existed,
// or ones already corrupted into NaN by that gap (see `monsterRecordKill`).
// There's no way to recover the original kill levels, so a corrupted or
// missing range collapses to a single unknown level and widens again
// naturally the next time the monster is killed.
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

// Every authored (static Encounter) or generated (EncounterRandom pool)
// place this monster can be fought - the data source for its "discoverable
// in" hint on an undiscovered entry.
function monsterEncounters(
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

// Item drops roll a quantity range that scales with the kill's level (via
// `rangeAtLevel`, the same resolution `rollDroppedRewards`/`loot.ts` uses to
// actually grant them); equipment/collectible/recipe drops are always a
// flat chance for one, regardless of level.
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

// Every monster in the game, killed or not - undiscovered entries are still
// returned so the bestiary can render them as silhouettes rather than
// omitting them entirely (see `filterBestiaryEntries`).
export function getBestiaryEntries(): BestiaryEntry[] {
  const monsters = getEntriesByType<MonsterContent>('monster');

  const entries = monsters.map((monster) => {
    const discovered = isMonsterDiscovered(monster.id);

    return {
      monster,
      discovered,
      kills: getMonsterKillCount(monster.id),
      levelRange: getMonsterLevelRangeFound(monster.id),
      foundAtNodes: getMonsterFoundAtNodes(monster.id).map(worldNodeDisplayName),
      sourceNodeNames: monsterSourceNodeNames(monster.id).map(worldNodeDisplayName),
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

// Undiscovered ("???") entries never match a search, by name, drop, or
// location - unlike the museum, a bestiary search can't hint at a monster
// the player hasn't killed yet.
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
