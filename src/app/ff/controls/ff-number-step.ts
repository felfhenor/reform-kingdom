import type { FFNumberBounds } from '@ff/interfaces/ff-input';
import { clamp } from 'es-toolkit/compat';

function ffStepDecimals(step: number): number {
  const [, fraction = ''] = String(step).split('.');
  return fraction.length;
}

// Steps within bounds, rounding to the step's precision so 0.05 steps don't drift into 0.30000000000000004.
export function ffStepNumber(
  value: number,
  steps: number,
  { min, max, step }: FFNumberBounds,
): number {
  const next = clamp(value + steps * step, min ?? -Infinity, max ?? Infinity);
  return Number(next.toFixed(ffStepDecimals(step)));
}
