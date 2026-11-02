import { signal } from '@angular/core';
import {
  edictScoreMultiplier,
  edictsActive,
  edictsFragmentTotal,
} from '@helpers/edict/edict';
import { error } from '@helpers/engine/logging';
import { remembranceCategories } from '@helpers/remembrance/remembrance';
import { savefileDiskLegacyWrite } from '@helpers/savefile/savefile-disk';
import {
  bestiaryState,
  clockState,
  discoveredMapsState,
  gamestate,
  metaState,
  runStatsState,
  worldPartyState,
  worldTownsState,
} from '@helpers/state-game';
import type {
  GameId,
  LegacyState,
  RunOutcome,
  RunRecord,
  RunRecordHero,
  RunRecordStats,
  RunStatsTotals,
} from '@interfaces';
import { omit } from 'es-toolkit';
import { sumBy } from 'es-toolkit/compat';

export const LEGACY_STORAGE_KEY = 'legacy';
export const LEGACY_VERSION = 1;

let legacyWritesBlocked = false;

export function defaultLegacy(): LegacyState {
  return { version: LEGACY_VERSION, runs: [] };
}

function legacyRunIsValid(run: RunRecord | null): boolean {
  return (
    typeof run?.id === 'string' &&
    !!run.outcome &&
    Array.isArray(run.party) &&
    Array.isArray(run.edicts) &&
    Array.isArray(run.stats?.completion)
  );
}

export function legacyIsValid(value: unknown): value is LegacyState {
  const state = value as LegacyState | null;
  return (
    typeof state?.version === 'number' &&
    Array.isArray(state.runs) &&
    state.runs.every(legacyRunIsValid)
  );
}

function legacyParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// A bad value is copied aside before Legacy starts fresh; if even that fails, writes stay blocked so it's never overwritten.
export function legacyLoad(): LegacyState {
  legacyWritesBlocked = false;
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (raw === null) return defaultLegacy();

  const parsed = legacyParse(raw);
  if (legacyIsValid(parsed)) return parsed;

  try {
    localStorage.setItem(`${LEGACY_STORAGE_KEY}-corrupt-${Date.now()}`, raw);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(defaultLegacy()));
  } catch {
    legacyWritesBlocked = true;
  }

  error('Legacy', 'Stored Legacy was unreadable; starting fresh.');
  return defaultLegacy();
}

export const legacy = signal<LegacyState>(legacyLoad());

export function legacyAddRun(state: LegacyState, run: RunRecord): LegacyState {
  const existing = state.runs.find((entry) => entry.id === run.id);
  if (existing?.outcome === 'Completed' && run.outcome === 'Abandoned') {
    return state;
  }

  return {
    ...state,
    runs: [...state.runs.filter((entry) => entry.id !== run.id), run],
  };
}

// Throws if the write fails (blocked Legacy, quota, private mode); call right after legacyLoad, which sets the block.
export function legacySave(next: LegacyState): void {
  if (legacyWritesBlocked) throw new Error('Legacy writes are blocked.');

  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(next));
  legacy.set(next);
  // The desktop copy is a fallback; localStorage stays the primary, so a failed disk write only logs.
  void savefileDiskLegacyWrite(next);
}

// Reloads first so a run another tab recorded since this one loaded isn't overwritten.
export function legacyRecordRun(run: RunRecord): void {
  legacySave(legacyAddRun(legacyLoad(), run));
}

export function legacyRunById(id: GameId): RunRecord | undefined {
  return legacy().runs.find((run) => run.id === id);
}

function legacyRunParty(): RunRecordHero[] {
  return worldPartyState().map((hero) => ({
    name: hero.name,
    jobId: hero.jobId,
    level: hero.level,
  }));
}

function legacyRunEdicts(): Pick<
  RunRecord,
  'edicts' | 'fragments' | 'multiplier'
> {
  const edicts = edictsActive();
  const fragments = edictsFragmentTotal(edicts);
  return {
    edicts: edicts.map((edict) => edict.id),
    fragments,
    multiplier: edictScoreMultiplier(fragments),
  };
}

function legacyRunTotals(): RunStatsTotals {
  return omit(runStatsState(), ['heroes']);
}

function legacyRunStats(): RunRecordStats {
  const bestiary = Object.values(bestiaryState());
  return {
    kills: sumBy(bestiary, (entry) => entry.kills),
    monstersKilled: bestiary.length,
    mapsReached: Object.keys(discoveredMapsState()).length,
    townsVisited: Object.values(worldTownsState()).filter(
      (town) => town.firstVisitedAtTick !== undefined,
    ).length,
    completion: remembranceCategories(),
    run: legacyRunTotals(),
  };
}

export function legacyRunFromGame(
  outcome: RunOutcome,
  endedAt = Date.now(),
): RunRecord {
  return {
    id: gamestate().gameId,
    outcome,
    startedAt: metaState().createdAt,
    endedAt,
    ticks: clockState().numTicks,
    party: legacyRunParty(),
    ...legacyRunEdicts(),
    stats: legacyRunStats(),
  };
}
