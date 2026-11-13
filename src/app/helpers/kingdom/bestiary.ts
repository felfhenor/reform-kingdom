import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { ledgerHas } from '@helpers/engine/ledger';
import { bestiaryState, updateGamestate } from '@helpers/state-game';
import { townGuardianMonsterIds } from '@helpers/town/town-guardian';
import type {
  DropRarity,
  EncounterContent,
  EncounterRandomContent,
  GameStateBestiary,
  LevelRange,
  MonsterContent,
  MonsterId,
} from '@interfaces';
import {
  taskEventMonsterKilled,
  taskEventMonstersAnalyzed,
} from '@helpers/task/task-events';

export function isMonsterDiscovered(monsterId: MonsterId): boolean {
  return ledgerHas(bestiaryState(), monsterId);
}

export function isWorldNodeFought(nodeName: string): boolean {
  return Object.values(bestiaryState()).some((entry) =>
    entry.foundAtNodes.includes(nodeName),
  );
}

export function getMonsterKillCount(monsterId: MonsterId): number {
  return bestiaryState()[monsterId]?.kills ?? 0;
}

export function getMonsterFoundAtNodes(monsterId: MonsterId): string[] {
  return bestiaryState()[monsterId]?.foundAtNodes ?? [];
}

// The actual min/max level the party has killed or analyzed this monster at; undefined until then.
export function getMonsterLevelRangeFound(
  monsterId: MonsterId,
): LevelRange | undefined {
  const entry = bestiaryState()[monsterId];
  if (!entry) return undefined;

  return { min: entry.minLevelFound, max: entry.maxLevelFound };
}

// Enough kills teach as much as Analyze, so parties without an Explorer still fill the bestiary.
export const ANALYZE_KILLS_BY_RARITY: Record<DropRarity, number> = {
  Common: 100,
  Uncommon: 75,
  Rare: 50,
  Mystical: 25,
  Legendary: 1,
};

export function monsterAnalyzeKillsRemaining(
  monster: MonsterContent,
  kills: number,
): number {
  return Math.max(0, ANALYZE_KILLS_BY_RARITY[monster.rarity] - kills);
}

function monsterKillsAnalyze(monsterId: MonsterId, kills: number): boolean {
  const monster = getEntry<MonsterContent>(monsterId);
  return !!monster && monsterAnalyzeKillsRemaining(monster, kills) === 0;
}

// First kill marks the monster discovered; later kills fold in level/location. Treats non-finite min/max as unset to avoid NaN poisoning from pre-level-tracking entries.
// Returns true when this kill analyzed the monster (only knowable inside a tick).
export function monsterRecordKill(
  monsterId: MonsterId,
  level: number,
  foundAtNode?: string,
): boolean {
  const alreadyDiscovered = isMonsterDiscovered(monsterId);
  let totalKills = undefined as number | undefined;

  const write = updateGamestate((state) => {
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
      analyzed: existing?.analyzed ?? false,
    };
    totalKills = state.bestiary[monsterId].kills;
    return state;
  });

  if (!alreadyDiscovered) bestiarySendEvent('Progress:Bestiary:Unlock', monsterId);

  // Outside a tick the write lands later, so the new total isn't known until then.
  if (totalKills !== undefined) {
    return monsterAfterKill(monsterId, totalKills, level, foundAtNode);
  }
  void write.then(() =>
    monsterAfterKill(monsterId, totalKills ?? 0, level, foundAtNode),
  );
  return false;
}

function monsterAfterKill(
  monsterId: MonsterId,
  totalKills: number,
  level: number,
  foundAtNode?: string,
): boolean {
  void taskEventMonsterKilled(monsterId, totalKills);
  return (
    monsterKillsAnalyze(monsterId, totalKills) &&
    monsterRecordAnalyze(monsterId, level, foundAtNode)
  );
}

function bestiarySendEvent(prefix: string, monsterId: MonsterId): void {
  const monsterName = getEntry<MonsterContent>(monsterId)?.name;
  if (!monsterName) return;
  analyticsSendDesignEvent(`${prefix}:${analyticsSafeSegment(monsterName)}`);
}

export function isMonsterAnalyzed(monsterId: MonsterId): boolean {
  return !!bestiaryState()[monsterId]?.analyzed;
}

export function bestiaryAnalyzedCount(bestiary: GameStateBestiary): number {
  return Object.values(bestiary).filter((entry) => entry.analyzed).length;
}

// Returns true only on the first analysis; an unkilled monster gets a zero-kill entry, which discovers it.
export function monsterRecordAnalyze(
  monsterId: MonsterId,
  level: number,
  foundAtNode?: string,
): boolean {
  if (isMonsterAnalyzed(monsterId)) return false;

  const alreadyDiscovered = isMonsterDiscovered(monsterId);
  const totalAnalyzed = bestiaryAnalyzedCount(bestiaryState()) + 1;

  void updateGamestate((state) => {
    const existing = state.bestiary[monsterId];
    if (existing) {
      existing.analyzed = true;
      return state;
    }

    state.bestiary[monsterId] = {
      foundAt: Date.now(),
      kills: 0,
      minLevelFound: level,
      maxLevelFound: level,
      foundAtNodes: foundAtNode ? [foundAtNode] : [],
      analyzed: true,
    };
    return state;
  });

  void taskEventMonstersAnalyzed(totalAnalyzed);

  bestiarySendEvent('Progress:Bestiary:Analyze', monsterId);
  if (!alreadyDiscovered) bestiarySendEvent('Progress:Bestiary:Unlock', monsterId);
  return true;
}

// Saves from before Analyze had no flag, so everything they had killed counts; kill thresholds also apply retroactively.
export function syncBestiaryAnalyzed(
  bestiary: GameStateBestiary,
): GameStateBestiary {
  const synced: GameStateBestiary = {};
  (Object.keys(bestiary) as MonsterId[]).forEach((monsterId) => {
    const entry = bestiary[monsterId];
    const analyzed =
      !('analyzed' in entry) ||
      entry.analyzed ||
      monsterKillsAnalyze(monsterId, entry.kills);
    synced[monsterId] =
      analyzed === entry.analyzed ? entry : { ...entry, analyzed };
  });
  return synced;
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

// Guardians that also spawn as enemies can be killed, so only guardian-only monsters are left out.
export function bestiaryMonsters(): MonsterContent[] {
  const guardianOnlyMonsterIds = new Set(
    townGuardianMonsterIds().filter(
      (monsterId) => monsterEncounters(monsterId).length === 0,
    ),
  );

  return getEntriesByType<MonsterContent>('monster').filter(
    (monster) => !guardianOnlyMonsterIds.has(monster.id),
  );
}
