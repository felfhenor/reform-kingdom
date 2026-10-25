import {
  NODE_REVEAL_LIFETIME_MS,
  NODE_REVEAL_OVERSHOOT,
  NODE_REVEAL_POP_MS,
} from '@helpers/config';
import { clamp } from 'es-toolkit/compat';

function easeOutBack(t: number): number {
  const c1 = NODE_REVEAL_OVERSHOOT;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

// Elapsed-time -> visual state. Returns undefined once the effect's lifetime has passed.
export function nodeRevealState(
  elapsedMs: number,
): { scale: number; ringScale: number; ringAlpha: number } | undefined {
  if (elapsedMs >= NODE_REVEAL_LIFETIME_MS) return undefined;

  const ringFraction = elapsedMs / NODE_REVEAL_LIFETIME_MS;
  return {
    scale: easeOutBack(clamp(elapsedMs / NODE_REVEAL_POP_MS, 0, 1)),
    ringScale: ringFraction,
    ringAlpha: 1 - ringFraction,
  };
}
