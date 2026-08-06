import { gamestate } from '@helpers/state-game';

export function timerTicksElapsed(): number {
  return gamestate().clock.numTicks;
}

export function timerLastSaveTick(): number {
  return gamestate().clock.lastSaveTick;
}

export function formatDuration(ticks: number): string {
  const totalSeconds = Math.max(0, Math.floor(ticks));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number) => value.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
