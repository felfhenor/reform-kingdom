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

export function gameReset(): void {
  resetGameState();
}
