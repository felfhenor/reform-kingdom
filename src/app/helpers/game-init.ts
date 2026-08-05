import { migrateGameState } from '@helpers/migrate';
import { setupFinish } from '@helpers/setup';
import { resetGameState } from '@helpers/state-game';
import { setWorld } from '@helpers/world';
import { worldgenGenerateWorld } from '@helpers/worldgen';

export async function gameStart(): Promise<void> {
  const world = await worldgenGenerateWorld();
  if (!world.didFinish) return;

  delete world.didFinish;

  setWorld(world);

  setTimeout(() => {
    setupFinish();
  }, 0);
}

// `resetGameState` replaces state with a bare `defaultGameState()`, bypassing
// the one-time startup migration - re-running it here ensures a fresh game
// still gets guaranteed grants like the Founding Stone.
export function gameReset(): void {
  resetGameState();
  migrateGameState();
}
