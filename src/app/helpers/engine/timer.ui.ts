import { formatDuration } from '@helpers/engine/timer';
import type { DurationPart } from '@interfaces';

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

// Fits a collapsed status bubble's badge: mm:ss under an hour, whole hours beyond.
export function formatDurationBadge(ticks: number): string {
  const hours = Math.floor(Math.max(0, ticks) / 3600);
  return hours < 1 ? formatDuration(ticks) : `${hours}h`;
}
