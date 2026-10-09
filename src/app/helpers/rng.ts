import type { Identifiable } from '@interfaces';
import { pull, sumBy } from 'es-toolkit/compat';
import seedrandom, { type PRNG } from 'seedrandom';
import { v4 as uuid4 } from 'uuid';

export function rngUuid(): string {
  return uuid4();
}

export function rngRandom(): PRNG {
  return rngSeeded(rngUuid());
}

export function rngSeeded(seed = rngUuid()): PRNG {
  return seedrandom(seed);
}

export function rngChoice<T>(choices: T[], rng = rngSeeded(rngUuid())): T {
  return choices[Math.floor(rng() * choices.length)];
}

export function rngShuffle<T>(choices: T[], rng = rngSeeded(rngUuid())): T[] {
  const baseArray = choices.slice();

  const shuffled = [];

  for (let i = 0; i < choices.length; i++) {
    const chosen = rngChoice(baseArray, rng);
    shuffled.push(chosen);
    pull(baseArray, chosen);
  }

  return shuffled;
}

export function rngChoiceIdentifiable<T extends Identifiable>(
  choices: T[],
  rng = rngSeeded(rngUuid()),
): string | undefined {
  if (choices.length === 0) return undefined;

  return choices[Math.floor(rng() * choices.length)].id;
}

export function rngNumber(max: number, rng = rngSeeded(rngUuid())): number {
  return Math.floor(rng() * max);
}

export function rngUniform(rng = rngSeeded(rngUuid())): number {
  return rng();
}

// Inclusive of both ends, so a range shown to players as "min-max" can roll its max.
export function rngNumberRange(
  min: number,
  max: number,
  rng = rngSeeded(rngUuid()),
): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  // No whole number fits between fractional bounds, so stay on a bound rather than step outside them.
  if (high < low) return min;

  return Math.floor(low + rng() * (high - low + 1));
}

export function rngSucceedsChance(
  max: number,
  rng = rngSeeded(rngUuid()),
): boolean {
  return rng() * 100 <= max;
}

export function rngChoiceWeighted<T>(
  items: T[],
  weightFn: (item: T) => number,
  rng = rngSeeded(rngUuid()),
): T | undefined {
  if (items.length === 0) return undefined;

  const totalWeight = sumBy(items, weightFn);
  if (totalWeight <= 0) return undefined;

  // Unfloored so fractional weights stay pickable.
  const randomValue = rngUniform(rng) * totalWeight;
  let cumulativeWeight = 0;

  for (const item of items) {
    cumulativeWeight += weightFn(item);
    if (randomValue < cumulativeWeight) return item;
  }

  return undefined;
}
