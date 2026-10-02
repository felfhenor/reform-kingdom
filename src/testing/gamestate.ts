import '@/testing/reset';
import { defaultGameState } from '@helpers/defaults';
import {
  gamestate,
  gamestateTickEnd,
  gamestateTickStart,
  setGameState,
} from '@helpers/state-game';
import type { GameState } from '@interfaces';

// Starts from defaultGameState() so a new required field never breaks a spec's fixture.
export function seedGamestate(edit?: (state: GameState) => void): GameState {
  const state = defaultGameState();
  edit?.(state);
  setGameState(state, false);
  return gamestate();
}

// Inside a tick, fire-and-forget updateGamestate calls apply synchronously.
export function inTick<T>(fn: () => T): T {
  gamestateTickStart();
  try {
    return fn();
  } finally {
    gamestateTickEnd();
  }
}
