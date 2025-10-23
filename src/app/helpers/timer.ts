import { gamestate } from '@helpers/state-game';

export function timerTicksElapsed(): number {
  return gamestate().clock.numTicks;
}

export function timerLastSaveTick(): number {
  return gamestate().clock.lastSaveTick;
}
