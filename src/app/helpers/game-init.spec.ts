import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/migrate', () => ({
  migrateGameState: vi.fn(),
}));

vi.mock('@helpers/savefile/savefile-load', () => ({
  savefileMarkFresh: vi.fn(),
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
import { savefileMarkFresh } from '@helpers/savefile/savefile-load';
import { resetGameState } from '@helpers/state-game';
import { getOption, setOption } from '@helpers/state-options';

describe('gameReset', () => {
  it('resets game state and re-runs migration so guaranteed grants still apply', () => {
    gameReset();

    expect(resetGameState).toHaveBeenCalled();
    expect(migrateGameState).toHaveBeenCalled();
  });

  it('unblocks saving before resetting, so a new game replacing an unloadable save persists', () => {
    gameReset();

    expect(
      vi.mocked(savefileMarkFresh).mock.invocationCallOrder.at(-1)!,
    ).toBeLessThan(vi.mocked(resetGameState).mock.invocationCallOrder.at(-1)!);
  });

  it('unpauses the gameloop, so a paused prior session does not carry over', () => {
    setOption('gameloopPaused', true);

    gameReset();

    expect(getOption('gameloopPaused')).toBe(false);
  });
});
