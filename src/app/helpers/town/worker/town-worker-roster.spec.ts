import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-progression', () => ({
  defaultTownWorkerState: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { gamestate } from '@helpers/state-game';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import {
  pruneInvalidTownWorkers,
  townWorkerRosterEntries,
  townWorkerRosterMaterialize,
  townWorkerStatusDisplay,
  townWorkers,
} from '@helpers/town/worker/town-worker-roster';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  GameState,
  TownContent,
  TownId,
  TownWorkerState,
  WorkerContent,
  WorkerId,
  WorldNodeEntry,
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
      goldRequiredBeforeCutoff: 1,
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

describe('townWorkerRosterEntries', () => {
  it('resolves each stored worker to its display entry', () => {
    const status = { kind: 'AtTown' } as const;
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            workers: {
              [darwinId]: { level: 3, status } as TownWorkerState,
            },
          },
        },
      },
    } as unknown as GameState);
    vi.mocked(getEntry).mockReturnValue({
      name: 'Darwin Nork',
      sprite: '0000',
      frames: 4,
    } as WorkerContent);

    expect(townWorkerRosterEntries(townId)).toEqual([
      {
        workerId: darwinId,
        name: 'Darwin Nork',
        sprite: '0000',
        frames: 4,
        level: 3,
        status,
      },
    ]);
  });

  it('skips a worker whose content no longer resolves', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            workers: { [darwinId]: { level: 3 } as TownWorkerState },
          },
        },
      },
    } as unknown as GameState);
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(townWorkerRosterEntries(townId)).toEqual([]);
  });

  it('returns an empty array when the town has no worker state', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    expect(townWorkerRosterEntries(townId)).toEqual([]);
  });
});

describe('townWorkerStatusDisplay', () => {
  const townEntry = { nodeName: 'Larsia' } as WorldNodeEntry;
  const destEntry = { nodeName: 'Iron Vein' } as WorldNodeEntry;

  beforeEach(() => {
    vi.mocked(worldNodeByName).mockImplementation((name: string) =>
      name === 'Larsia' ? townEntry : destEntry,
    );
  });

  it('labels an idle worker as at the town', () => {
    expect(townWorkerStatusDisplay(buildTown(), { kind: 'AtTown' })).toEqual({
      label: 'At Town',
      locationEntry: townEntry,
    });
  });

  it('labels a traveling worker with its destination node', () => {
    expect(
      townWorkerStatusDisplay(buildTown(), {
        kind: 'TravelingTo',
        nodeName: 'Iron Vein',
        itemId: 'iron-ore' as never,
        path: [],
        ticksIntoStep: 0,
      }),
    ).toEqual({
      label: 'Traveling to Iron Vein',
      locationEntry: destEntry,
    });
  });

  it('labels a gathering worker with its gather node', () => {
    expect(
      townWorkerStatusDisplay(buildTown(), {
        kind: 'Gathering',
        nodeName: 'Iron Vein',
        itemId: 'iron-ore' as never,
        itemsGathered: 1,
        ticksIntoGather: 0,
      }),
    ).toEqual({
      label: 'Gathering at Iron Vein',
      locationEntry: destEntry,
    });
  });

  it('labels a resting worker as at the town', () => {
    expect(
      townWorkerStatusDisplay(buildTown(), {
        kind: 'Resting',
        ticksIntoRest: 0,
      }),
    ).toEqual({ label: 'Resting', locationEntry: townEntry });
  });

  it('labels a returning worker as at the town', () => {
    expect(
      townWorkerStatusDisplay(buildTown(), {
        kind: 'TravelingBack',
        path: [],
        ticksIntoStep: 0,
        carriedQuantity: 0,
      }),
    ).toEqual({ label: 'Returning to town', locationEntry: townEntry });
  });
});
