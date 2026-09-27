import { timerTicksElapsed } from '@helpers/engine/timer';
import { updateGamestate, worldTownsState } from '@helpers/state-game';
import type { TownId, TownTickSubsystem } from '@interfaces';

// Per-subsystem, not a single shared gate - independently-cadenced tick functions would otherwise clobber each other's due-check.
// An un-activated town (no state entry - never visited) is never due, so callers don't each have to re-check activation themselves.
export function isTownDueForUpdate(
  townId: TownId,
  subsystem: TownTickSubsystem,
  interval: number,
): boolean {
  const state = worldTownsState()[townId];
  if (!state) return false;

  const lastProcessed = state.lastProcessedTick[subsystem];
  if (lastProcessed === undefined) return true;

  return timerTicksElapsed() - lastProcessed >= interval;
}

// An every-tick subsystem is always due on the next tick, so recording it would only churn the towns slice.
export function markTownSubsystemProcessed(
  townId: TownId,
  subsystem: TownTickSubsystem,
  interval: number,
): void {
  if (interval <= 1) return;

  const nowTick = timerTicksElapsed();

  updateGamestate((state) => {
    const town = state.world.towns[townId];
    if (!town) return state;

    town.lastProcessedTick[subsystem] = nowTick;

    return state;
  });
}
