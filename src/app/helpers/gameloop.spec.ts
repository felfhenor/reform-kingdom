import type { Mock } from 'vitest';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';

vi.mock('@helpers/caravan/caravan-tick');
vi.mock('@helpers/combat/combat');
vi.mock('@helpers/commission/commission-tick');
vi.mock('@helpers/crafting/crafting-queue');
vi.mock('@helpers/decree/auto-mode');
vi.mock('@helpers/encounter/encounter-random-tick');
vi.mock('@helpers/engine/discord');
vi.mock('@helpers/engine/logging');
vi.mock('@helpers/engine/scheduler');
vi.mock('@helpers/hero/global-effects');
vi.mock('@helpers/hero/resting');
vi.mock('@helpers/hero/travel');
vi.mock('@helpers/item/gathering');
vi.mock('@helpers/kingdom/astral-projector');
vi.mock('@helpers/town/crafting/town-craft-priority-state');
vi.mock('@helpers/town/crafting/town-craft-queue');
vi.mock('@helpers/town/raid/town-raid-tick');
vi.mock('@helpers/town/shop/town-shop-tick');
vi.mock('@helpers/town/town-commission-generate');
vi.mock('@helpers/town/worker/town-worker-tick');
vi.mock('@helpers/worker/worker-tick');

import { caravanProcessTick } from '@helpers/caravan/caravan-tick';
import { combatDoCombatIteration } from '@helpers/combat/combat';
import { commissionProcessTick } from '@helpers/commission/commission-tick';
import { TICKS_PER_YIELD } from '@helpers/config';
import { craftProcessTick } from '@helpers/crafting/crafting-queue';
import { autoModeProcessTick } from '@helpers/decree/auto-mode';
import { encounterRandomProcessTick } from '@helpers/encounter/encounter-random-tick';
import { error } from '@helpers/engine/logging';
import { schedulerYield } from '@helpers/engine/scheduler';
import { gameloop } from '@helpers/gameloop';
import { globalEffectsProcessTick } from '@helpers/hero/global-effects';
import { restingProcessTick } from '@helpers/hero/resting';
import { travelProcessTick } from '@helpers/hero/travel';
import { gatheringProcessTick } from '@helpers/item/gathering';
import { astralProjectorProcessTick } from '@helpers/kingdom/astral-projector';
import { gamestate, isGameStateReady } from '@helpers/state-game';
import { defaultOptions, setOptions } from '@helpers/state-options';
import { townSpecialtyPriorityProcessTick } from '@helpers/town/crafting/town-craft-priority-state';
import { townCraftProcessTick } from '@helpers/town/crafting/town-craft-queue';
import { townRaidProcessTick } from '@helpers/town/raid/town-raid-tick';
import { townShopProcessTick } from '@helpers/town/shop/town-shop-tick';
import { townCommissionProcessTick } from '@helpers/town/town-commission-generate';
import { townWorkerProcessTick } from '@helpers/town/worker/town-worker-tick';
import { workersProcessTick } from '@helpers/worker/worker-tick';
import type { GameOptions } from '@interfaces';
import { buildCombat } from '@/testing/builders';
import { seedGamestate } from '@/testing/gamestate';

const subsystems: Mock[] = [
  travelProcessTick,
  globalEffectsProcessTick,
  astralProjectorProcessTick,
  gatheringProcessTick,
  encounterRandomProcessTick,
  caravanProcessTick,
  commissionProcessTick,
  autoModeProcessTick,
  craftProcessTick,
  restingProcessTick,
  workersProcessTick,
  townWorkerProcessTick,
  townSpecialtyPriorityProcessTick,
  townCraftProcessTick,
  townShopProcessTick,
  townRaidProcessTick,
  townCommissionProcessTick,
].map((fn) => vi.mocked(fn));

const numTicks = () => gamestate().clock.numTicks;
const lastSaveTick = () => gamestate().clock.lastSaveTick;

function useOptions(overrides: Partial<GameOptions> = {}): void {
  setOptions({
    ...defaultOptions(),
    gameloopPaused: false,
    debugTickMultiplier: 1,
    debugSaveInterval: 999_999,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, '', '/game');
  isGameStateReady.set(true);
  useOptions();
  seedGamestate((state) => (state.meta.isSetup = true));
});

afterEach(() => {
  window.history.pushState({}, '', '/');
  isGameStateReady.set(false);
  setOptions(defaultOptions());
});

describe('gameloop', () => {
  it('advances the clock once per tick, running every subsystem each tick', async () => {
    await gameloop(3);

    expect(numTicks()).toBe(3);
    subsystems.forEach((fn) => expect(fn).toHaveBeenCalledTimes(3));
  });

  it('runs a combat iteration only on ticks spent in combat', async () => {
    await gameloop(2);
    expect(combatDoCombatIteration).not.toHaveBeenCalled();

    seedGamestate((state) => {
      state.meta.isSetup = true;
      state.world.combat = buildCombat();
    });
    await gameloop(2);
    expect(combatDoCombatIteration).toHaveBeenCalledTimes(2);
  });

  it('scales the batch by the tick multiplier, between 1 and 3600 ticks', async () => {
    useOptions({ debugTickMultiplier: 3 });
    await gameloop(2);
    expect(numTicks()).toBe(6);

    useOptions();
    await gameloop(0);
    expect(numTicks()).toBe(7);

    useOptions({ debugTickMultiplier: 1000 });
    await gameloop(10);
    expect(numTicks()).toBe(7 + 3600);
  });

  it('does nothing before setup, before the save is ready, off the game page, or while paused', async () => {
    seedGamestate();
    await gameloop(1);

    seedGamestate((state) => (state.meta.isSetup = true));
    isGameStateReady.set(false);
    await gameloop(1);

    isGameStateReady.set(true);
    window.history.pushState({}, '', '/');
    await gameloop(1);

    window.history.pushState({}, '', '/game');
    useOptions({ gameloopPaused: true });
    await gameloop(1);

    expect(numTicks()).toBe(0);
    expect(travelProcessTick).not.toHaveBeenCalled();
  });

  it.each([
    [TICKS_PER_YIELD - 1, 0],
    [TICKS_PER_YIELD, 1],
    [TICKS_PER_YIELD + 1, 1],
    [3600, 3600 / TICKS_PER_YIELD],
  ])('over %i ticks, yields to the browser %i times', async (ticks, yields) => {
    await gameloop(ticks);

    expect(numTicks()).toBe(ticks);
    expect(schedulerYield).toHaveBeenCalledTimes(yields);
  });

  it('saves once the save interval has passed, and not before', async () => {
    useOptions({ debugSaveInterval: 5 });

    await gameloop(4);
    expect(lastSaveTick()).toBe(0);

    await gameloop(1);
    expect(lastSaveTick()).toBe(5);
  });

  it('ignores a call landing while a batch is suspended at a yield', async () => {
    let releaseFirstYield = () => {};
    vi.mocked(schedulerYield).mockImplementationOnce(
      () => new Promise<void>((resolve) => (releaseFirstYield = resolve)),
    );
    // A failed assertion mid-batch would otherwise leave the loop stuck for every later test.
    onTestFinished(() => releaseFirstYield());

    const firstRun = gameloop(TICKS_PER_YIELD * 2);
    await Promise.resolve();
    expect(numTicks()).toBe(TICKS_PER_YIELD);

    await gameloop(1);
    expect(numTicks()).toBe(TICKS_PER_YIELD);

    releaseFirstYield();
    await firstRun;
    expect(numTicks()).toBe(TICKS_PER_YIELD * 2);
  });

  describe('when a tick subsystem throws', () => {
    const failure = new Error('boom');

    beforeEach(() => {
      vi.mocked(travelProcessTick).mockImplementationOnce(() => {
        throw failure;
      });
    });

    it('resolves, logging the error', async () => {
      await expect(gameloop(1)).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledWith(
        'Gameloop:Tick',
        expect.any(String),
        failure,
      );
    });

    it('commits progress up to the failure and lets the next batch run on from it', async () => {
      await gameloop(1);
      expect(numTicks()).toBe(1);

      await gameloop(1);
      expect(numTicks()).toBe(2);
    });

    it('skips the save for the failed batch', async () => {
      useOptions({ debugSaveInterval: 0 });

      await gameloop(1);
      expect(lastSaveTick()).toBe(0);

      await gameloop(1);
      expect(lastSaveTick()).toBe(2);
    });
  });
});
