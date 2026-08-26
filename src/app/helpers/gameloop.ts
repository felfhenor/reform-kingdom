import { LoggerTimer } from 'logger-timer';

import { computed } from '@angular/core';
import { caravanProcessTick } from '@helpers/caravan/caravan-tick';
import { combatDoCombatIteration, currentCombat } from '@helpers/combat/combat';
import { commissionProcessTick } from '@helpers/commission/commission-tick';
import { craftProcessTick } from '@helpers/crafting/crafting-queue';
import { autoModeProcessTick } from '@helpers/decree/auto-mode';
import { discordUpdateStatus } from '@helpers/engine/discord';
import { encounterRandomProcessTick } from '@helpers/encounter/encounter-random-tick';
import { debug } from '@helpers/engine/logging';
import { schedulerYield } from '@helpers/engine/scheduler';
import { timerLastSaveTick, timerTicksElapsed } from '@helpers/engine/timer';
import { globalEffectsProcessTick } from '@helpers/hero/global-effects';
import { restingProcessTick } from '@helpers/hero/resting';
import { travelProcessTick } from '@helpers/hero/travel';
import { gatheringProcessTick } from '@helpers/item/gathering';
import { astralProjectorProcessTick } from '@helpers/kingdom/astral-projector';
import { isSetup } from '@helpers/setup';
import {
  gamestateTickEnd,
  gamestateTickStart,
  isGameStateReady,
  saveGameState,
  updateGamestate,
} from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { workersProcessTick } from '@helpers/worker/worker-tick';
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
    commissionProcessTick();
    autoModeProcessTick();
    craftProcessTick();
    restingProcessTick();
    workersProcessTick();

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
