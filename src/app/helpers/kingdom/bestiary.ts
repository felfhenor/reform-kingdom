import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  EncounterContent,
  EncounterRandomContent,
  GameStateBestiary,
  LevelRange,
  MonsterContent,
  MonsterId,
} from '@interfaces';

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

// Repairs entries predating min/max level tracking by collapsing them to a single unknown level; widens again on the next kill.
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
