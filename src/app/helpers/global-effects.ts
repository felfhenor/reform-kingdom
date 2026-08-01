import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { timerTicksElapsed } from '@helpers/timer';
import type { GlobalEffect, GlobalEffectContent, GlobalEffectId } from '@interfaces';

export function activeGlobalEffects(): GlobalEffect[] {
  const currentTick = timerTicksElapsed();
  return gamestate().globalEffects.filter(
    (effect) => effect.expiresAtTick > currentTick,
  );
}

export function isGlobalEffectActive(globalEffectId: GlobalEffectId): boolean {
  return activeGlobalEffects().some((effect) => effect.id === globalEffectId);
}

export function addGlobalEffect(
  globalEffectId: GlobalEffectId,
  durationTicks: number,
): void {
  const content = getEntry<GlobalEffectContent>(globalEffectId);
  if (!content) return;

  const currentTick = timerTicksElapsed();

  updateGamestate((state) => {
    state.globalEffects.push({
      ...content,
      startTick: currentTick,
      expiresAtTick: currentTick + durationTicks,
    });

    return state;
  });
}

export function removeGlobalEffect(id: GlobalEffectId): void {
  updateGamestate((state) => {
    state.globalEffects = state.globalEffects.filter(
      (effect) => effect.id !== id,
    );

    return state;
  });
}
