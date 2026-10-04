import '@/testing/reset';
import type { WritableSignal } from '@angular/core';
import { defaultGameState } from '@helpers/defaults';
import { indexedDbSignal } from '@helpers/engine/signal';
import {
  GAMESTATE_STORAGE_KEY,
  gamestate,
  gamestateTickEnd,
  gamestateTickStart,
  setGameState,
} from '@helpers/state-game';
import type { GameState } from '@interfaces';
import { vi } from 'vitest';

// The test setup swaps indexedDbSignal for a plain signal, so this is the save as stored; read at import, before any mock reset.
export const storedSave = vi.mocked(indexedDbSignal).mock.results[
  vi
    .mocked(indexedDbSignal)
    .mock.calls.findIndex(([key]) => key === GAMESTATE_STORAGE_KEY)
].value as WritableSignal<GameState>;

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
