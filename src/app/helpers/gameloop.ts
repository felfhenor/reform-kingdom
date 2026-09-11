import { LoggerTimer } from 'logger-timer';

import { computed } from '@angular/core';
import { caravanProcessTick } from '@helpers/caravan/caravan-tick';
import { combatDoCombatIteration } from '@helpers/combat/combat';
import { currentCombat } from '@helpers/combat/combat-state';
import { commissionProcessTick } from '@helpers/commission/commission-tick';
import { TICKS_PER_YIELD } from '@helpers/config';
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
import { townCommissionProcessTick } from '@helpers/town/town-commission-generate';
import { townCraftProcessTick } from '@helpers/town/crafting/town-craft-queue';
import { townSpecialtyPriorityProcessTick } from '@helpers/town/crafting/town-craft-priority-state';
import { townRaidProcessTick } from '@helpers/town/raid/town-raid-tick';
import { townShopProcessTick } from '@helpers/town/shop/town-shop-tick';
import { townWorkerProcessTick } from '@helpers/town/worker/town-worker-tick';
import { workersProcessTick } from '@helpers/worker/worker-tick';

import { clamp } from 'es-toolkit/compat';

export const isGameloopPaused = computed(() => getOption('gameloopPaused'));

// Guards the loop from a second call landing mid-batch now that it yields - e.g. a manual `window.api.gameloop()` during a catch-up.
let isProcessingTicks = false;

export function gameloopShouldRun(): boolean {
  return window.location.toString().includes('/game');
}

export async function gameloop(totalTicks: number): Promise<void> {
  if (!isSetup()) return;
  if (!isGameStateReady()) return;
  if (!gameloopShouldRun()) return;
  if (isGameloopPaused()) return;
  if (isProcessingTicks) return;

  isProcessingTicks = true;
  try {
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
      townWorkerProcessTick();
      townSpecialtyPriorityProcessTick();
      townCraftProcessTick();
      townShopProcessTick();
      townRaidProcessTick();
      townCommissionProcessTick();

      if (currentCombat()) {
        combatDoCombatIteration();
      }

      if ((i + 1) % TICKS_PER_YIELD === 0) {
        await schedulerYield();
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
  } finally {
    isProcessingTicks = false;
  }
}
