import {
  pruneInvalidArmoryItems,
  pruneInvalidDiscoveredEquipment,
} from '@helpers/armory';
import {
  grantFoundingStoneIfMissing,
  pruneInvalidCollectibles,
} from '@helpers/collectibles';
import { pruneInvalidCraftQueues } from '@helpers/crafting';
import { defaultGameState } from '@helpers/defaults';
import {
  backfillEquipmentBlock,
  backfillEquipmentItem,
} from '@helpers/equipment';
import { pruneInvalidMaterials } from '@helpers/materials';
import { pruneInvalidPartyEquipment } from '@helpers/party';
import { pruneInvalidDiscoveredRecipes } from '@helpers/recipes';
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

  newState.armory = newState.armory.map(backfillEquipmentItem);
  newState.world.party = newState.world.party.map((character) => ({
    ...character,
    equipment: backfillEquipmentBlock(character.equipment),
  }));

  newState.armory = pruneInvalidArmoryItems(newState.armory);
  newState.materials = pruneInvalidMaterials(newState.materials);
  newState.discoveredEquipment = pruneInvalidDiscoveredEquipment(
    newState.discoveredEquipment,
  );
  newState.collectibles = pruneInvalidCollectibles(newState.collectibles);
  newState.collectibles = grantFoundingStoneIfMissing(newState.collectibles);
  newState.discoveredRecipes = pruneInvalidDiscoveredRecipes(
    newState.discoveredRecipes,
  );
  newState.tradeskills = pruneInvalidCraftQueues(newState.tradeskills);
  newState.world.party = pruneInvalidPartyEquipment(newState.world.party);

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
