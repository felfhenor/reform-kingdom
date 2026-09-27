import { clamp } from 'es-toolkit/compat';

// Raw prompt input may be blank or non-numeric; anything unusable becomes 0 (cancel).
export function caravanTradeQuantityFromInput(
  value: unknown,
  maxQuantity: number,
): number {
  const requested = Math.floor(Number(value));
  return Number.isFinite(requested) ? clamp(requested, 0, maxQuantity) : 0;
}
