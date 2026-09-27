import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    updateGamestate: vi.fn(),
    worldTownsState: () => gamestate().world.towns,
  };
});

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type { GameState, TownId } from '@interfaces';

const townId = 'larsia' as TownId;

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
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    markTownSubsystemProcessed(townId, 'craft', 60);

    expect(state.world.towns[townId].lastProcessedTick).toEqual({
      worker: 1,
      craft: 1234,
    });
  });

  it('writes nothing for an every-tick subsystem (interval 1)', () => {
    markTownSubsystemProcessed(townId, 'craft', 1);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('no-ops when the town has no state entry', () => {
    const state = { world: { towns: {} } } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    expect(() => markTownSubsystemProcessed(townId, 'craft', 60)).not.toThrow();
    expect(state.world.towns).toEqual({});
  });
});
