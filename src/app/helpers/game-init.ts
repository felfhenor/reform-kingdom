import { resetCombatLog } from '@helpers/combat/combat-log';
import { applyEdictStartingItems } from '@helpers/edict/edict';
import { ledgerMark } from '@helpers/engine/ledger';
import {
  heroesSubviewClear,
  kingdomSubviewClear,
  setGamePlayView,
} from '@helpers/engine/ui';
import { grantStartingGold } from '@helpers/item/materials';
import { stateMarkPartyEquipmentDiscovered } from '@helpers/kingdom/armory';
import { migrateGameState } from '@helpers/migrate';
import { savefileMarkFresh } from '@helpers/savefile/savefile-load';
import { setupFinish } from '@helpers/setup';
import {
  globalEffectSumsState,
  resetGameState,
  updateGamestate,
} from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import { setWorld } from '@helpers/world';
import { worldNodeDevelopmentApplyStartingLevels } from '@helpers/world-node/world-node-development-state';
import { applyOutpostBuffRefresh } from '@helpers/world-node/world-node-outpost-buff';
import { worldNodeAt } from '@helpers/world-node/world-nodes';
import { worldgenGenerateWorld } from '@helpers/worldgen';

export async function gameStart(): Promise<void> {
  const world = await worldgenGenerateWorld();
  if (!world.didFinish) return;

  delete world.didFinish;

  setWorld(world);
  await updateGamestate((state) => {
    grantStartingGold(state);
    applyEdictStartingItems(state);
    worldNodeDevelopmentApplyStartingLevels(state);
    applyOutpostBuffRefresh(state, state.world.currentLocation.mapName);
    stateMarkPartyEquipmentDiscovered(state);
    const { mapName, x, y } = state.world.currentLocation;
    ledgerMark(state.discoveredMaps, mapName);
    const startNode = worldNodeAt(mapName, x, y);
    if (startNode) ledgerMark(state.visitedWorldNodes, startNode.nodeName);
    return state;
  });

  // A default, not a lock: the player can turn feature tutorials back on mid-run.
  if (globalEffectSumsState().featuresRevealed)
    setOption('skipFeatureTutorials', true);

  await setupFinish();
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
  heroesSubviewClear();
  resetCombatLog();
}
