import { LoggerTimer } from 'logger-timer';

import { computed } from '@angular/core';
import { debug } from '@helpers/logging';
import { schedulerYield } from '@helpers/scheduler';
import { isSetup } from '@helpers/setup';
import {
  gamestateTickEnd,
  gamestateTickStart,
  isGameStateReady,
  saveGameState,
  updateGamestate,
} from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { timerLastSaveTick, timerTicksElapsed } from '@helpers/timer';
import { clamp } from 'es-toolkit/compat';

export const isGameloopPaused = computed(() => getOption('gameloopPaused'));

export function gameloopShouldRun(): boolean {
  return window.location.toString().includes('/game');
}

export async function gameloop(totalTicks: number): Promise<void> {
  if (!isSetup()) return;
  if (!isGameStateReady()) return;
  if (!gameloopShouldRun()) return;
  if (isGameloopPaused()) return;

  gamestateTickStart();

  const ticksToCalculate = totalTicks * getOption('debugTickMultiplier');
  const numTicks = clamp(ticksToCalculate, 1, 3600);

  const timer = new LoggerTimer({
    dumpThreshold: 100,
    isActive: getOption('debugGameloopTimerUpdates'),
  });

  timer.startTimer('gameloop');

  // TODO: game logic (lol)

  timer.dumpTimers((timers) => debug('Gameloop:Timers', timers));

  updateGamestate((state) => {
    state.clock.numTicks += numTicks;
    return state;
  });

  gamestateTickEnd();

  const currentTick = timerTicksElapsed();
  const nextSaveTick = timerLastSaveTick() + getOption('debugSaveInterval');
  if (currentTick >= nextSaveTick) {
    updateGamestate((state) => {
      state.clock.lastSaveTick = currentTick;
      return state;
    });

    await schedulerYield();
    saveGameState();
    debug('Gameloop:Save', `Saving @ tick ${currentTick}`);
  }
}
