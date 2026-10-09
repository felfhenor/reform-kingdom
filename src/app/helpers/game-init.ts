import { resetCombatLog } from '@helpers/combat/combat-log';
import { kingdomSubviewClear, setGamePlayView } from '@helpers/engine/ui';
import { grantStartingGold } from '@helpers/item/materials';
import { migrateGameState } from '@helpers/migrate';
import { savefileMarkFresh } from '@helpers/savefile/savefile-load';
import { setupFinish } from '@helpers/setup';
import { resetGameState, updateGamestate } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import { setWorld } from '@helpers/world';
import { worldMapMarkVisited } from '@helpers/world-node/world-map-discovery';
import { worldgenGenerateWorld } from '@helpers/worldgen';

export async function gameStart(): Promise<void> {
  const world = await worldgenGenerateWorld();
  if (!world.didFinish) return;

  delete world.didFinish;

  setWorld(world);
  await updateGamestate((state) => {
    grantStartingGold(state);
    worldMapMarkVisited(state, state.world.currentLocation.mapName);
    return state;
  });

  setTimeout(() => {
    setupFinish();
  }, 0);
}

export function gameReset(): void {
  savefileMarkFresh();
  resetGameState();
  migrateGameState();

  // The pause option lives outside game state (it's a persisted user
  // option), so a paused prior session would otherwise carry over here.
  setOption('gameloopPaused', false);

  setGamePlayView('world');
  kingdomSubviewClear();
  resetCombatLog();
}
