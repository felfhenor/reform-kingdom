import { describe, expect, it, vi } from 'vitest';

import { defaultLegacy, LEGACY_STORAGE_KEY } from '@helpers/legacy/legacy';
import {
  legacyMergeFrom,
  legacyMergeStates,
  legacyRunPreferred,
} from '@helpers/legacy/legacy-merge';
import type { GameId, LegacyState, RunOutcome, RunRecord } from '@interfaces';

function run(id: string, outcome: RunOutcome, endedAt = 1): RunRecord {
  return {
    id: id as GameId,
    outcome,
    startedAt: 0,
    endedAt,
    ticks: 0,
    party: [],
    edicts: [],
    fragments: 0,
    multiplier: 1,
    stats: {
      kills: 0,
      monstersKilled: 0,
      mapsReached: 0,
      townsVisited: 0,
      completion: [],
    },
  };
}

function legacyOf(...runs: RunRecord[]): LegacyState {
  return { ...defaultLegacy(), runs };
}

function storeLegacy(state: LegacyState): void {
  vi.mocked(localStorage.getItem).mockReturnValueOnce(JSON.stringify(state));
}

describe('legacyRunPreferred', () => {
  it('prefers Completed, then the later finish, and keeps mine on a tie', () => {
    const mine = run('a', 'Abandoned', 5);

    expect(legacyRunPreferred(mine, run('a', 'Completed', 1)).outcome).toBe(
      'Completed',
    );
    expect(legacyRunPreferred(run('a', 'Completed', 1), mine).outcome).toBe(
      'Completed',
    );
    expect(legacyRunPreferred(mine, run('a', 'Abandoned', 9)).endedAt).toBe(9);
    expect(legacyRunPreferred(mine, run('a', 'Abandoned', 2))).toBe(mine);
    expect(legacyRunPreferred(mine, run('a', 'Abandoned', 5))).toBe(mine);
  });
});

describe('legacyMergeStates', () => {
  it('unions runs across sources, keeping base order and appending new ones', () => {
    const merged = legacyMergeStates(legacyOf(run('a', 'Abandoned', 5)), [
      legacyOf(run('b', 'Completed')),
      legacyOf(run('a', 'Abandoned', 2), run('c', 'Abandoned')),
    ]);

    expect(merged.runs.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
    expect(merged.runs[0].endedAt).toBe(5);
  });
});

describe('legacyMergeFrom', () => {
  it('treats missing sections as unchanged and bad or newer ones as invalid', () => {
    expect(legacyMergeFrom([])).toBe('unchanged');
    expect(legacyMergeFrom([undefined])).toBe('unchanged');
    expect(legacyMergeFrom([{ runs: 'nope' }])).toBe('invalid');
    expect(legacyMergeFrom([{ version: 2, runs: [] }])).toBe('invalid');
  });

  it('writes only when the merge adds or upgrades a run', () => {
    storeLegacy(legacyOf(run('a', 'Completed')));
    expect(legacyMergeFrom([legacyOf(run('a', 'Abandoned', 9))])).toBe(
      'unchanged',
    );
    expect(localStorage.setItem).not.toHaveBeenCalled();

    storeLegacy(legacyOf(run('a', 'Completed')));
    expect(legacyMergeFrom([legacyOf(run('b', 'Completed'))])).toBe('merged');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      LEGACY_STORAGE_KEY,
      JSON.stringify(legacyOf(run('a', 'Completed'), run('b', 'Completed'))),
    );
  });

  it('reports a blocked Legacy as unsaved instead of throwing', () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce('{oops');
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new Error('quota');
    });

    expect(legacyMergeFrom([legacyOf(run('b', 'Completed'))])).toBe('unsaved');
  });
});
