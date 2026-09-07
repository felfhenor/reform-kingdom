import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-progression', () => ({
  defaultTownWorkerState: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import {
  pruneInvalidTownWorkers,
  townWorkerRosterMaterialize,
  townWorkers,
} from '@helpers/town/worker/town-worker-roster';
import type {
  TownContent,
  TownId,
  TownWorkerState,
  WorkerId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const darwinId = 'darwin' as WorkerId;
const talbotId = 'talbot' as WorkerId;

function buildTown(overrides: Partial<TownContent> = {}): TownContent {
  return {
    id: townId,
    name: 'Larsia',
    __type: 'town',
    gathering: {
      gatherRateMultiplier: 1,
      goldGatheredPerMaterial: 1,
      materialThresholds: [],
      workers: [
        { workerId: darwinId, level: 1 },
        { workerId: talbotId, level: 2 },
      ],
    },
    ...overrides,
  } as TownContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townWorkers', () => {
  it("reads the town content's gathering.workers list", () => {
    vi.mocked(getEntry).mockReturnValue(buildTown());

    expect(townWorkers(townId)).toEqual([
      { workerId: darwinId, level: 1 },
      { workerId: talbotId, level: 2 },
    ]);
  });

  it('returns an empty array when the town no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(townWorkers(townId)).toEqual([]);
  });
});

describe('townWorkerRosterMaterialize', () => {
  it('creates state for every roster entry missing one', () => {
    const defaultState = { level: 1 } as TownWorkerState;
    vi.mocked(defaultTownWorkerState).mockReturnValue(defaultState);

    const result = townWorkerRosterMaterialize(buildTown(), {});

    expect(result).toEqual({
      [darwinId]: defaultState,
      [talbotId]: defaultState,
    });
  });

  it('leaves an already-materialized worker untouched', () => {
    const existingState = { level: 9 } as TownWorkerState;

    const result = townWorkerRosterMaterialize(buildTown(), {
      [darwinId]: existingState,
    });

    expect(result[darwinId]).toBe(existingState);
    expect(defaultTownWorkerState).toHaveBeenCalledTimes(1);
    expect(defaultTownWorkerState).toHaveBeenCalledWith(buildTown(), 2);
  });
});

describe('pruneInvalidTownWorkers', () => {
  it('keeps workers still in the roster', () => {
    const workers = {
      [darwinId]: { level: 1 } as TownWorkerState,
      [talbotId]: { level: 2 } as TownWorkerState,
    };

    expect(pruneInvalidTownWorkers(buildTown(), workers)).toEqual(workers);
  });

  it('drops a worker no longer referenced by the town', () => {
    const removedId = 'removed' as WorkerId;
    const workers = {
      [darwinId]: { level: 1 } as TownWorkerState,
      [removedId]: { level: 1 } as TownWorkerState,
    };

    expect(pruneInvalidTownWorkers(buildTown(), workers)).toEqual({
      [darwinId]: { level: 1 },
    });
  });
});
