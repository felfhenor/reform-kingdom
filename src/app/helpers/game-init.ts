import { grantStartingGold } from '@helpers/materials';
import { migrateGameState } from '@helpers/migrate';
import { setupFinish } from '@helpers/setup';
import { resetGameState, updateGamestate } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import { setWorld } from '@helpers/world';
import { worldgenGenerateWorld } from '@helpers/worldgen';

export async function gameStart(): Promise<void> {
  const world = await worldgenGenerateWorld();
  if (!world.didFinish) return;

  delete world.didFinish;

  setWorld(world);
  await updateGamestate((state) => {
    grantStartingGold(state);
    return state;
  });

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

  // The pause option lives outside game state (it's a persisted user
  // option), so a paused prior session would otherwise carry over here.
  setOption('gameloopPaused', false);
}
