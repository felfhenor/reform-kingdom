import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/migrate', () => ({
  migrateGameState: vi.fn(),
}));

vi.mock('@helpers/setup', () => ({
  setupFinish: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  resetGameState: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  setWorld: vi.fn(),
}));

vi.mock('@helpers/worldgen', () => ({
  worldgenGenerateWorld: vi.fn(),
}));

import { gameReset } from '@helpers/game-init';
import { migrateGameState } from '@helpers/migrate';
import { resetGameState } from '@helpers/state-game';

describe('gameReset', () => {
  it('resets game state and re-runs migration so guaranteed grants still apply', () => {
    gameReset();

    expect(resetGameState).toHaveBeenCalled();
    expect(migrateGameState).toHaveBeenCalled();
  });
});
