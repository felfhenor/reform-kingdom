import { LoggerTimer } from 'logger-timer';

import { computed } from '@angular/core';
import { astralProjectorProcessTick } from '@helpers/astral-projector';
import { autoModeProcessTick } from '@helpers/auto-mode';
import { caravanProcessTick } from '@helpers/caravan-tick';
import { combatDoCombatIteration, currentCombat } from '@helpers/combat';
import { craftProcessTick } from '@helpers/crafting-queue';
import { discordUpdateStatus } from '@helpers/discord';
import { encounterRandomProcessTick } from '@helpers/encounter-random-tick';
import { gatheringProcessTick } from '@helpers/gathering';
import { globalEffectsProcessTick } from '@helpers/global-effects';
import { debug } from '@helpers/logging';
import { restingProcessTick } from '@helpers/resting';
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
import { travelProcessTick } from '@helpers/travel';
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

  // Tick one at a time (not one bulk +=) so tick-driven systems see an accurate timerTicksElapsed() each iteration.
  for (let i = 0; i < numTicks; i++) {
    updateGamestate((state) => {
      state.clock.numTicks += 1;
      return state;
    });

    travelProcessTick();
    globalEffectsProcessTick();
    astralProjectorProcessTick();
    gatheringProcessTick();
    encounterRandomProcessTick();
    caravanProcessTick();
    autoModeProcessTick();
    craftProcessTick();
    restingProcessTick();

    if (currentCombat()) {
      combatDoCombatIteration();
    }
  }

  timer.dumpTimers((timers) => debug('Gameloop:Timers', timers));

  discordUpdateStatus();

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
