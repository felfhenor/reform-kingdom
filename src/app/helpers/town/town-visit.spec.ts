import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
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

import { getEntry } from '@helpers/content';
import {
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townMarkVisited } from '@helpers/town/town-visit';
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

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Town:Visit:Larsia',
    );
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
