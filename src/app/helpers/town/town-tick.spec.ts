import type * as TownWorkerRosterHelper from '@helpers/town/worker/town-worker-roster';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-roster', async (importOriginal) => {
  const actual = await importOriginal<typeof TownWorkerRosterHelper>();
  return {
    ...actual,
    townWorkerRosterMaterialize: vi.fn((_town, existing) => existing),
  };
});

import { getEntry } from '@helpers/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
  pruneInvalidTowns,
} from '@helpers/town/town-tick';
import { townWorkerRosterMaterialize } from '@helpers/town/worker/town-worker-roster';
import type {
  GameState,
  GameStateTowns,
  TownContent,
  TownId,
  WorkerId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const darwinId = 'darwin' as WorkerId;

const town: TownContent = {
  id: townId,
  name: 'Larsia',
  __type: 'town',
  description: 'A desert town.',
  hidden: false,
  invisibleUntilCollectibleIdsFound: [],
  scaleType: 'City',
  level: 25,
  crafting: {
    maxQueueSize: 12,
    maxTradeskillLevel: 20,
    specialtyTradeskillId: 'jewelcrafting' as never,
    uniqueRecipeIds: [],
  },
  traders: { sellItemCount: 10, markupPercentages: { sell: 25, buy: -15 } },
  gathering: {
    gatherRateMultiplier: 5,
    goldGatheredPerMaterial: 5,
    goldRequiredBeforeCutoff: 25000,
    workers: [{ workerId: darwinId, level: 1 }],
  },
  reputation: { buff: { name: 'Larsian Influence', tiers: [] } },
  defense: {
    rewards: [],
    guardian: { numGuardians: 3, guardianName: 'Larsian Citizen' },
    assaulter: { numMonsters: 15, monsterIds: [], level: { min: 20, max: 25 } },
    quests: { commissions: [] },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isTownDueForUpdate', () => {
  it('is due when the subsystem has never been processed', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { lastProcessedTick: {} } } },
    } as unknown as GameState);

    expect(isTownDueForUpdate(townId, 'worker', 100)).toBe(true);
  });

  it('is due when the interval has elapsed', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { lastProcessedTick: { worker: 100 } } } },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(250);

    expect(isTownDueForUpdate(townId, 'worker', 100)).toBe(true);
  });

  it('is not due when the interval has not elapsed', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { lastProcessedTick: { worker: 100 } } } },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(150);

    expect(isTownDueForUpdate(townId, 'worker', 100)).toBe(false);
  });

  it('is not due when the town has no state entry (never activated)', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    expect(isTownDueForUpdate(townId, 'worker', 100)).toBe(false);
  });

  it('gates independently per subsystem', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: { [townId]: { lastProcessedTick: { worker: 900 } } },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(1000);

    expect(isTownDueForUpdate(townId, 'worker', 500)).toBe(false);
    expect(isTownDueForUpdate(townId, 'raid', 500)).toBe(true);
  });
});

describe('markTownSubsystemProcessed', () => {
  it('stamps the current tick for the given subsystem only', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(1234);
    const state = {
      world: {
        towns: { [townId]: { lastProcessedTick: { worker: 1 } } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    markTownSubsystemProcessed(townId, 'craft');

    expect(state.world.towns[townId].lastProcessedTick).toEqual({
      worker: 1,
      craft: 1234,
    });
  });

  it('no-ops when the town has no state entry', () => {
    const state = { world: { towns: {} } } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    expect(() => markTownSubsystemProcessed(townId, 'craft')).not.toThrow();
    expect(state.world.towns).toEqual({});
  });
});

describe('pruneInvalidTowns', () => {
  it('keeps entries that resolve to real content', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    const towns: GameStateTowns = {
      [townId]: { lastProcessedTick: {}, stock: [], workers: {} },
    };

    expect(pruneInvalidTowns(towns)).toEqual(towns);
  });

  it('drops entries whose id no longer resolves to real content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const towns: GameStateTowns = {
      [townId]: { lastProcessedTick: {}, stock: [], workers: {} },
    };

    expect(pruneInvalidTowns(towns)).toEqual({});
  });

  it('backfills missing stock/workers on a legacy entry', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    const towns = {
      [townId]: { lastProcessedTick: {} },
    } as unknown as GameStateTowns;

    expect(pruneInvalidTowns(towns)).toEqual({
      [townId]: { lastProcessedTick: {}, stock: [], workers: {} },
    });
  });

  it('drops stock entries whose referenced item no longer resolves', () => {
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === townId ? town : undefined,
    );
    const towns: GameStateTowns = {
      [townId]: {
        lastProcessedTick: {},
        stock: [{ itemId: 'removed-item' as never, quantity: 1 }],
        workers: {},
      },
    };

    expect(pruneInvalidTowns(towns)).toEqual({
      [townId]: { lastProcessedTick: {}, stock: [], workers: {} },
    });
  });

  it('drops worker state for a WorkerId no longer in the roster', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    const removedId = 'removed' as WorkerId;
    const towns: GameStateTowns = {
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: {
          [darwinId]: { level: 1 } as never,
          [removedId]: { level: 1 } as never,
        },
      },
    };

    expect(pruneInvalidTowns(towns)).toEqual({
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: { [darwinId]: { level: 1 } },
      },
    });
  });

  it('materializes any newly-authored roster entries on an already-activated town', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    vi.mocked(townWorkerRosterMaterialize).mockReturnValue({
      [darwinId]: { level: 1 },
    } as never);
    const towns: GameStateTowns = {
      [townId]: { lastProcessedTick: {}, stock: [], workers: {} },
    };

    expect(pruneInvalidTowns(towns)).toEqual({
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: { [darwinId]: { level: 1 } },
      },
    });
    expect(townWorkerRosterMaterialize).toHaveBeenCalledWith(town, {});
  });
});
