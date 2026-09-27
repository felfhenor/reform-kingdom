import type { Character } from '@interfaces';

// Positive HP/EP gains since the last snapshot - zeros for a character seen for the first time.
export function characterVitalsGain(
  previous: Pick<Character, 'hp' | 'ep'> | undefined,
  current: Pick<Character, 'hp' | 'ep'>,
): { hp: number; ep: number } {
  if (!previous) return { hp: 0, ep: 0 };

  return {
    hp: Math.max(0, current.hp - previous.hp),
    ep: Math.max(0, current.ep - previous.ep),
  };
}
