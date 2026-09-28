import type { GameState } from '@interfaces';
import { isPlainObject } from 'es-toolkit';

// Only checks fields every save has had since the first release, so old-but-migratable saves still pass.
export function savefileValidationErrors(state: unknown): string[] {
  if (!isPlainObject(state)) return ['The savefile is not a game state.'];

  const errors: string[] = [];

  if (!isPlainObject(state['meta']))
    errors.push('Savefile metadata is missing.');
  if (typeof state['gameId'] !== 'string') errors.push('Game id is missing.');

  const clock = state['clock'];
  if (!isPlainObject(clock) || typeof clock['numTicks'] !== 'number') {
    errors.push('Game clock is missing or corrupt.');
  }

  const world = state['world'];
  if (!isPlainObject(world)) {
    errors.push('World data is missing.');
  } else if (world['party'] !== undefined && !Array.isArray(world['party'])) {
    errors.push('Party data is corrupt.');
  }

  return errors;
}

export function savefileIsValid(state: unknown): state is GameState {
  return savefileValidationErrors(state).length === 0;
}

export function savefileIsWorthKeeping(state: unknown): state is GameState {
  return savefileIsValid(state) && state.meta.isSetup === true;
}
