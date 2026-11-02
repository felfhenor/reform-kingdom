import { error } from '@helpers/engine/logging';
import {
  LEGACY_VERSION,
  legacyIsValid,
  legacyLoad,
  legacySave,
} from '@helpers/legacy/legacy';
import type { LegacyMergeResult, LegacyState, RunRecord } from '@interfaces';

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

  return { ...base, runs };
}

// A newer build's Legacy may have a shape this one can't read, so it's skipped rather than half-merged.
function legacyIsMergeable(value: unknown): value is LegacyState {
  return legacyIsValid(value) && value.version <= LEGACY_VERSION;
}

export function legacyMergeFrom(values: unknown[]): LegacyMergeResult {
  const present = values.filter((value) => value !== undefined);
  const mergeable = present.filter(legacyIsMergeable);
  if (mergeable.length === 0) {
    return present.length === 0 ? 'unchanged' : 'invalid';
  }

  const current = legacyLoad();
  const next = legacyMergeStates(current, mergeable);
  if (JSON.stringify(next.runs) === JSON.stringify(current.runs)) {
    return 'unchanged';
  }

  try {
    legacySave(next);
    return 'merged';
  } catch (e) {
    error('Legacy', 'Failed to save merged Legacy:', e);
    return 'unsaved';
  }
}
