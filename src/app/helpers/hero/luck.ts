import { rngSeeded, rngSucceedsChance, rngUuid } from '@helpers/rng';
import type { PRNG } from 'seedrandom';

// Shared LUK curve used by every luck-driven mechanic (crit, dodge, status
// resist, bonus yield): a flat luck/100 chance, since LUK growth is expected
// to stay well under 100.
export function luckRollSucceeds(
  luck: number,
  rng: PRNG = rngSeeded(rngUuid()),
): boolean {
  return rngSucceedsChance(luck, rng);
}

// Scales a base percent chance down by the defender's luck, e.g. a 20% status
// chance against 25 LUK becomes 15%.
export function luckReducedChance(baseChance: number, luck: number): number {
  return baseChance * (1 - luck / 100);
}
