import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSafeSegment: vi.fn((s) => s),
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-roster', () => ({
  townWorkerRosterMaterialize: vi.fn((_town, existing) => existing),
}));

import { getEntry } from '@helpers/content/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townMarkVisited } from '@helpers/town/town-visit';
import { townWorkerRosterMaterialize } from '@helpers/town/worker/town-worker-roster';
import type { GameState, TownContent, TownId } from '@interfaces';

const townId = 'larsia' as TownId;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townMarkVisited', () => {
  it('creates a state entry stamped with the current tick on first visit', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const state = { world: { towns: {} } } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(state.world.towns[townId]).toEqual({
      lastProcessedTick: {},
      stock: [],
      workers: {},
      reputation: 0,
      hiddenGold: 0,
      materials: {},
      tradeskills: {},
      craftQueue: [],
      firstVisitedAtTick: 500,
    });
  });

  it('fires the analytics event with the town name on first visit', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    vi.mocked(updateGamestate).mockImplementation(async (fn) =>
      fn({ world: { towns: {} } } as unknown as GameState),
    );
    vi.mocked(getEntry).mockReturnValue({ name: 'Larsia' } as TownContent);

    townMarkVisited(townId);

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith('Town:Visit:Larsia');
  });

  it('preserves existing lastProcessedTick progress when activating', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: { [townId]: { lastProcessedTick: { worker: 42 } } },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const state = {
      world: {
        towns: { [townId]: { lastProcessedTick: { worker: 42 } } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(state.world.towns[townId]).toEqual({
      lastProcessedTick: { worker: 42 },
      stock: [],
      workers: {},
      reputation: 0,
      hiddenGold: 0,
      materials: {},
      tradeskills: {},
      craftQueue: [],
      firstVisitedAtTick: 500,
    });
  });

  it('preserves existing stock when activating', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: { lastProcessedTick: {}, stock: [{ quantity: 3 }] },
        },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const state = {
      world: {
        towns: {
          [townId]: { lastProcessedTick: {}, stock: [{ quantity: 3 }] },
        },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(state.world.towns[townId].stock).toEqual([{ quantity: 3 }]);
  });

  it('preserves existing reputation when activating', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: { [townId]: { lastProcessedTick: {}, reputation: 250 } },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const state = {
      world: {
        towns: { [townId]: { lastProcessedTick: {}, reputation: 250 } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(state.world.towns[townId].reputation).toBe(250);
  });

  it('preserves existing hiddenGold when activating', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: { [townId]: { lastProcessedTick: {}, hiddenGold: 1200 } },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const state = {
      world: {
        towns: { [townId]: { lastProcessedTick: {}, hiddenGold: 1200 } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(state.world.towns[townId].hiddenGold).toBe(1200);
  });

  it('preserves existing materials when activating', () => {
    const materials = { 'copper-ore': 8 };
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: { [townId]: { lastProcessedTick: {}, materials } },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const state = {
      world: {
        towns: { [townId]: { lastProcessedTick: {}, materials } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(state.world.towns[townId].materials).toEqual(materials);
  });

  it('preserves existing tradeskills when activating', () => {
    const tradeskills = { blacksmithing: { level: 3 } };
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: { [townId]: { lastProcessedTick: {}, tradeskills } },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const state = {
      world: {
        towns: { [townId]: { lastProcessedTick: {}, tradeskills } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(state.world.towns[townId].tradeskills).toEqual(tradeskills);
  });

  it('preserves existing craftQueue when activating', () => {
    const craftQueue = [{ id: 'q1', tradeskillId: 'blacksmithing' }];
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: { [townId]: { lastProcessedTick: {}, craftQueue } },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const state = {
      world: {
        towns: { [townId]: { lastProcessedTick: {}, craftQueue } },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(state.world.towns[townId].craftQueue).toEqual(craftQueue);
  });

  it('materializes the worker roster via townWorkerRosterMaterialize when the town resolves', () => {
    const town = { name: 'Larsia' } as TownContent;
    vi.mocked(getEntry).mockReturnValue(town);
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: { lastProcessedTick: {}, workers: { existing: 1 } },
        },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    vi.mocked(townWorkerRosterMaterialize).mockReturnValue({
      materialized: 1,
    } as never);
    const state = {
      world: {
        towns: {
          [townId]: { lastProcessedTick: {}, workers: { existing: 1 } },
        },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(townWorkerRosterMaterialize).toHaveBeenCalledWith(town, {
      existing: 1,
    });
    expect(state.world.towns[townId].workers).toEqual({ materialized: 1 });
  });

  it('is a no-op and fires no analytics if the town was already visited', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: { lastProcessedTick: {}, firstVisitedAtTick: 100 },
        },
      },
    } as unknown as GameState);
    vi.mocked(timerTicksElapsed).mockReturnValue(999);
    const state = {
      world: {
        towns: {
          [townId]: { lastProcessedTick: {}, firstVisitedAtTick: 100 },
        },
      },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townMarkVisited(townId);

    expect(state.world.towns[townId].firstVisitedAtTick).toBe(100);
    expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
  });
});
