import { error } from '@helpers/engine/logging';
import {
  LEGACY_VERSION,
  legacyIsValid,
  legacyLoad,
  legacySave,
  legacyWithAchievements,
} from '@helpers/legacy/legacy';
import type {
  AchievementUnlock,
  AchievementUnlocks,
  LegacyMergeResult,
  LegacyState,
  RunRecord,
  SavefileDiskRead,
} from '@interfaces';

// Incoming copies can be older snapshots, so they only ever upgrade a run: Completed first, then the later finish.
export function legacyRunPreferred(
  mine: RunRecord,
  incoming: RunRecord,
): RunRecord {
  if (mine.outcome !== incoming.outcome) {
    return mine.outcome === 'Completed' ? mine : incoming;
  }

  return incoming.endedAt > mine.endedAt ? incoming : mine;
}

// Earliest unlock wins; keeps the base key order so an unchanged merge serializes identically.
export function legacyMergeAchievements(
  base: AchievementUnlocks,
  incoming: AchievementUnlocks[],
): AchievementUnlocks {
  const merged = { ...base };
  incoming
    .flatMap((unlocks) => Object.entries(unlocks))
    .forEach(([id, unlock]) => {
      const mine: AchievementUnlock | undefined =
        merged[id as keyof AchievementUnlocks];
      if (!unlock || (mine && mine.unlockedAt <= unlock.unlockedAt)) return;
      merged[id as keyof AchievementUnlocks] = unlock;
    });

  return merged;
}

// A missing section reads as empty, so an older Legacy compares equal to one with no unlocks yet.
function legacyContentsEqual(a: LegacyState, b: LegacyState): boolean {
  return (
    JSON.stringify(a.runs) === JSON.stringify(b.runs) &&
    JSON.stringify(a.achievements ?? {}) ===
      JSON.stringify(b.achievements ?? {})
  );
}

// Keeps the base order and appends new runs, so an unchanged merge serializes identically.
export function legacyMergeStates(
  base: LegacyState,
  incoming: LegacyState[],
): LegacyState {
  const runs = [...base.runs];
  incoming
    .flatMap((state) => state.runs)
    .forEach((run) => {
      const index = runs.findIndex((entry) => entry.id === run.id);
      if (index === -1) {
        runs.push(run);
        return;
      }

      runs[index] = legacyRunPreferred(runs[index], run);
    });

  return {
    ...base,
    runs,
    achievements: legacyMergeAchievements(
      base.achievements ?? {},
      incoming.map((state) => state.achievements ?? {}),
    ),
  };
}

// A newer build's Legacy may have a shape this one can't read, so it's skipped rather than half-merged.
function legacyIsMergeable(value: unknown): value is LegacyState {
  return legacyIsValid(value) && value.version <= LEGACY_VERSION;
}

export function legacyMergeFrom(values: unknown[]): LegacyMergeResult {
  const present = values.filter((value) => value !== undefined);
  const mergeable = present
    .filter(legacyIsMergeable)
    .map(legacyWithAchievements);
  if (mergeable.length === 0) {
    return present.length === 0 ? 'unchanged' : 'invalid';
  }

  const current = legacyLoad();
  const next = legacyMergeStates(current, mergeable);
  if (legacyContentsEqual(next, current)) return 'unchanged';

  try {
    legacySave(next);
    return 'merged';
  } catch (e) {
    error('Legacy', 'Failed to save merged Legacy:', e);
    return 'unsaved';
  }
}

// Only an unchanged merge proves the stored copy already holds every disk run, and a copy this build can't read is never overwritten.
export function legacyShouldSeedDisk(
  result: LegacyMergeResult,
  disk: SavefileDiskRead,
  stored: LegacyState,
): boolean {
  const isEmpty =
    stored.runs.length === 0 &&
    Object.keys(stored.achievements ?? {}).length === 0;
  if (result !== 'unchanged' || isEmpty) return false;
  if (disk.status === 'missing') return true;
  if (disk.status === 'unreadable' || !legacyIsMergeable(disk.value)) {
    return false;
  }

  return !legacyContentsEqual(legacyWithAchievements(disk.value), stored);
}
