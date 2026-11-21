import { clamp } from 'es-toolkit/compat';

export function percentOf(value: number, percent: number): number {
  return Math.floor((value * clamp(percent, 0, 100)) / 100);
}
