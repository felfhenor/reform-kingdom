import { gamestate } from '@helpers/state-game';
import type { DurationPart } from '@interfaces';

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

  if (totalSeconds < 3600) return `${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function ticksToDurationParts(ticks: number): DurationPart[] {
  const totalSeconds = Math.max(0, Math.floor(ticks));

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const allParts: DurationPart[] = [
    { value: days, unit: 'day' },
    { value: hours, unit: 'hour' },
    { value: minutes, unit: 'minute' },
    { value: seconds, unit: 'second' },
  ];
  const parts = allParts.filter((part) => part.value > 0);

  return parts.length === 0 ? [{ value: 0, unit: 'second' }] : parts;
}
