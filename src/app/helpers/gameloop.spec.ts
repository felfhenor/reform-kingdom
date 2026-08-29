import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/caravan/caravan-tick', () => ({
  caravanProcessTick: vi.fn(),
}));

vi.mock('@helpers/combat/combat', () => ({
  combatDoCombatIteration: vi.fn(),
}));

vi.mock('@helpers/combat/combat-state', () => ({
  currentCombat: vi.fn(() => undefined),
}));

vi.mock('@helpers/commission/commission-tick', () => ({
  commissionProcessTick: vi.fn(),
}));

vi.mock('@helpers/crafting/crafting-queue', () => ({
  craftProcessTick: vi.fn(),
}));

vi.mock('@helpers/decree/auto-mode', () => ({
  autoModeProcessTick: vi.fn(),
}));

vi.mock('@helpers/engine/discord', () => ({
  discordUpdateStatus: vi.fn(),
}));

vi.mock('@helpers/encounter/encounter-random-tick', () => ({
  encounterRandomProcessTick: vi.fn(),
}));

vi.mock('@helpers/engine/logging', () => ({
  debug: vi.fn(),
}));

vi.mock('@helpers/engine/scheduler', () => ({
  schedulerYield: vi.fn(() => Promise.resolve()),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerLastSaveTick: vi.fn(() => 0),
  timerTicksElapsed: vi.fn(() => 0),
}));

vi.mock('@helpers/hero/global-effects', () => ({
  globalEffectsProcessTick: vi.fn(),
}));

vi.mock('@helpers/hero/resting', () => ({
  restingProcessTick: vi.fn(),
}));

vi.mock('@helpers/hero/travel', () => ({
  travelProcessTick: vi.fn(),
}));

vi.mock('@helpers/item/gathering', () => ({
  gatheringProcessTick: vi.fn(),
}));

vi.mock('@helpers/kingdom/astral-projector', () => ({
  astralProjectorProcessTick: vi.fn(),
}));

vi.mock('@helpers/setup', () => ({
  isSetup: vi.fn(() => true),
}));

vi.mock('@helpers/state-game', () => ({
  gamestateTickEnd: vi.fn(),
  gamestateTickStart: vi.fn(),
  isGameStateReady: vi.fn(() => true),
  saveGameState: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/state-options', () => ({
  getOption: vi.fn(),
}));

vi.mock('@helpers/worker/worker-tick', () => ({
  workersProcessTick: vi.fn(),
}));

import { schedulerYield } from '@helpers/engine/scheduler';
import { gameloop } from '@helpers/gameloop';
import { updateGamestate } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import type { GameState } from '@interfaces';

describe('gameloop', () => {
  let mockClockState: { clock: { numTicks: number; lastSaveTick: number } };

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/game');

    mockClockState = { clock: { numTicks: 0, lastSaveTick: 0 } };
    vi.mocked(updateGamestate).mockImplementation(async (func) => {
      func(mockClockState as unknown as GameState);
    });

    vi.mocked(getOption).mockImplementation(((key: string) => {
      const options: Record<string, unknown> = {
        gameloopPaused: false,
        debugTickMultiplier: 1,
        debugGameloopTimerUpdates: false,
        debugSaveInterval: 999999,
      };
      return options[key];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('does not yield for a batch below the yield threshold', async () => {
    await gameloop(99);
    expect(mockClockState.clock.numTicks).toBe(99);
    expect(schedulerYield).not.toHaveBeenCalled();
  });

  it('yields exactly once right at the yield threshold', async () => {
    await gameloop(100);
    expect(mockClockState.clock.numTicks).toBe(100);
    expect(schedulerYield).toHaveBeenCalledTimes(1);
  });

  it('yields once just past the threshold, not twice', async () => {
    await gameloop(101);
    expect(mockClockState.clock.numTicks).toBe(101);
    expect(schedulerYield).toHaveBeenCalledTimes(1);
  });

  it('processes a full 3600-tick catch-up batch without losing or duplicating ticks', async () => {
    await gameloop(3600);
    expect(mockClockState.clock.numTicks).toBe(3600);
    expect(schedulerYield).toHaveBeenCalledTimes(36);
  });

  it('ignores a reentrant call while a batch is already suspended at a yield point', async () => {
    // Only the first schedulerYield call pauses (tick 100); later calls, including gameloop(200)'s own second yield at tick 200, resolve immediately.
    let releaseFirstYield: () => void = () => {};
    let yieldCalls = 0;
    vi.mocked(schedulerYield).mockImplementation(() => {
      yieldCalls += 1;
      if (yieldCalls > 1) return Promise.resolve();
      return new Promise<void>((resolve) => (releaseFirstYield = resolve));
    });

    const firstRun = gameloop(200);
    await Promise.resolve();
    expect(mockClockState.clock.numTicks).toBe(100);

    // A second call while the first is suspended mid-batch must no-op, not clobber the in-flight tick draft.
    await gameloop(1);
    expect(mockClockState.clock.numTicks).toBe(100);

    releaseFirstYield();
    await firstRun;
    expect(mockClockState.clock.numTicks).toBe(200);
  });
});
