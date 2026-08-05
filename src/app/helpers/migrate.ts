import { pruneInvalidArmoryItems } from '@helpers/armory';
import { defaultGameState } from '@helpers/defaults';
import { pruneInvalidMaterials } from '@helpers/materials';
import {
  gamestate,
  gamestateTickEnd,
  gamestateTickStart,
  saveGameState,
  setGameState,
} from '@helpers/state-game';
import { defaultOptions, options, setOptions } from '@helpers/state-options';
import { merge } from 'es-toolkit/compat';

export function migrateGameState() {
  const state = gamestate();
  const newState = merge(defaultGameState(), state);

  newState.armory = pruneInvalidArmoryItems(newState.armory);
  newState.materials = pruneInvalidMaterials(newState.materials);

  setGameState(newState);
  gamestateTickStart();
  gamestateTickEnd();
  saveGameState();
}

export function migrateOptionsState() {
  const state = options();

  const newState = merge(defaultOptions(), state);

  setOptions(newState);
}
