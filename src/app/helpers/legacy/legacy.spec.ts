import { describe, expect, it, vi } from 'vitest';

import { ensureEdict } from '@helpers/content/ensure-edict';
import {
  defaultLegacy,
  LEGACY_STORAGE_KEY,
  legacy,
  legacyAddRun,
  legacyIsValid,
  legacyLoad,
  legacyRecordRun,
  legacyRunById,
  legacyRunFromGame,
} from '@helpers/legacy/legacy';
import type {
  EdictId,
  GameId,
  JobId,
  MonsterId,
  RunRecord,
  TownId,
} from '@interfaces';
import { buildCharacter, buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

function run(id: string, outcome: RunRecord['outcome']): RunRecord {
  return { ...legacyRunFromGame(outcome, 0), id: id as GameId };
}

const bestiaryEntry = (kills: number) => ({
  foundAt: 0,
  kills,
  minLevelFound: 1,
  maxLevelFound: 1,
  foundAtNodes: [],
});

describe('legacyRunFromGame', () => {
  it('snapshots the run from gamestate', () => {
    const might = ensureEdict({ id: 'might' as EdictId, fragments: 2 });
    seedContent([might]);
    const state = seedGamestate((draft) => {
      draft.meta.createdAt = 100;
      draft.clock.numTicks = 42;
      draft.edicts = [might.id];
      draft.world.party = [
        buildCharacter({ name: 'Ada', jobId: 'mage' as JobId, level: 7 }),
      ];
      draft.bestiary = {
        ['wolf' as MonsterId]: bestiaryEntry(3),
        ['bat' as MonsterId]: bestiaryEntry(2),
      };
      draft.discoveredMaps = { Vale: { foundAt: 0 } };
      draft.world.towns = {
        ['a' as TownId]: buildTownNodeState({ firstVisitedAtTick: 5 }),
        ['b' as TownId]: buildTownNodeState(),
      };
    });

    const record = legacyRunFromGame('Completed', 200);

    expect(record).toMatchObject({
      id: state.gameId,
      outcome: 'Completed',
      startedAt: 100,
      endedAt: 200,
      ticks: 42,
      party: [{ name: 'Ada', jobId: 'mage', level: 7 }],
      edicts: [might.id],
      fragments: 2,
      multiplier: 1.2,
      stats: { kills: 5, monstersKilled: 2, mapsReached: 1, townsVisited: 1 },
    });
    expect(record.stats.completion.length).toBeGreaterThan(0);
  });
});

describe('legacyAddRun', () => {
  it('replaces a run with the same id', () => {
    const state = legacyAddRun(defaultLegacy(), run('a', 'Abandoned'));
    const next = legacyAddRun(state, run('a', 'Completed'));

    expect(next.runs.map((entry) => entry.outcome)).toEqual(['Completed']);
  });

  it('never downgrades a Completed run to Abandoned or Lost', () => {
    const state = legacyAddRun(defaultLegacy(), run('a', 'Completed'));
    expect(legacyAddRun(state, run('a', 'Abandoned'))).toBe(state);
    expect(legacyAddRun(state, run('a', 'Lost'))).toBe(state);
  });
});

describe('legacyIsValid', () => {
  it('rejects values without a runs list of identified runs', () => {
    expect(legacyIsValid(defaultLegacy())).toBe(true);
    expect(legacyIsValid(undefined)).toBe(false);
    expect(legacyIsValid({ runs: 'nope' })).toBe(false);
    expect(legacyIsValid({ runs: [] })).toBe(false);
    const badHero = { name: 'Ada', stats: { kills: 1 } };
    expect(
      legacyIsValid({
        version: 1,
        runs: [{ ...run('a', 'Completed'), party: [badHero] }],
      }),
    ).toBe(false);
    expect(
      legacyIsValid({ version: 1, runs: [{ id: 'a', outcome: 'Completed' }] }),
    ).toBe(false);
  });

  it('accepts runs without seals but rejects malformed ones', () => {
    seedGamestate();
    const withSeals = (seals: unknown) => {
      const entry = run('a', 'Completed');
      const stats = { ...entry.stats, run: { ...entry.stats.run, seals } };
      return { version: 1, runs: [{ ...entry, stats }] };
    };

    expect(legacyIsValid(withSeals(undefined))).toBe(true);
    expect(legacyIsValid(withSeals({ carrina: 500 }))).toBe(true);
    expect(legacyIsValid(withSeals(['carrina']))).toBe(false);
    expect(legacyIsValid(withSeals({ carrina: 'soon' }))).toBe(false);
  });

  it('rejects runs with a malformed Remembrance entry', () => {
    seedGamestate();
    const entry = run('a', 'Completed');
    const completion = [{ name: 'Tasks', current: 'lots', max: 10 }];

    expect(
      legacyIsValid({
        version: 1,
        runs: [{ ...entry, stats: { ...entry.stats, completion } }],
      }),
    ).toBe(false);
  });

  it('rejects runs without a numeric multiplier or Fragments', () => {
    seedGamestate();
    const entry = run('a', 'Completed');

    expect(
      legacyIsValid({ version: 1, runs: [{ ...entry, multiplier: 'x' }] }),
    ).toBe(false);
    expect(
      legacyIsValid({ version: 1, runs: [{ ...entry, fragments: undefined }] }),
    ).toBe(false);
  });
});

describe('legacyRecordRun', () => {
  it('keeps runs another tab recorded since this one loaded', () => {
    const other = legacyAddRun(defaultLegacy(), run('other', 'Completed'));
    vi.mocked(localStorage.getItem).mockReturnValueOnce(JSON.stringify(other));

    legacyRecordRun(run('mine', 'Abandoned'));
    expect(legacy().runs.map((entry) => entry.id)).toEqual(['other', 'mine']);
  });

  it('writes the run to storage and the signal', () => {
    const record = run('a', 'Completed');
    legacyRecordRun(record);

    expect(legacyRunById(record.id)).toEqual(record);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      LEGACY_STORAGE_KEY,
      JSON.stringify(legacy()),
    );
  });
});

describe('legacyLoad', () => {
  it('loads a valid stored Legacy', () => {
    const stored = legacyAddRun(defaultLegacy(), run('a', 'Completed'));
    vi.mocked(localStorage.getItem).mockReturnValueOnce(JSON.stringify(stored));

    expect(legacyLoad()).toEqual(stored);
  });

  it('copies an unreadable value aside once, then starts fresh', () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce('{oops');

    expect(legacyLoad()).toEqual(defaultLegacy());
    expect(localStorage.setItem).toHaveBeenCalledWith(
      expect.stringMatching(/^legacy-corrupt-/),
      '{oops',
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      LEGACY_STORAGE_KEY,
      JSON.stringify(defaultLegacy()),
    );
  });

  it('blocks writes when the unreadable value cannot be copied aside', () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce('{oops');
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new Error('quota');
    });

    expect(() => legacyRecordRun(run('b', 'Completed'))).toThrow();
  });
});
