import {
  pruneInvalidArmoryItems,
  pruneInvalidDiscoveredEquipment,
} from '@helpers/armory';
import {
  pruneInvalidBestiaryEntries,
  repairInvalidBestiaryLevels,
} from '@helpers/bestiary';
import {
  grantFoundingStoneIfMissing,
  pruneInvalidCollectibles,
} from '@helpers/collectibles';
import { retrofitPartyXp } from '@helpers/character-progress';
import { pruneInvalidCraftQueues } from '@helpers/crafting';
import { defaultGameState } from '@helpers/defaults';
import {
  backfillEquipmentBlock,
  backfillEquipmentItem,
} from '@helpers/equipment';
import {
  grandfatherGatherNodeDiscoveries,
  pruneInvalidGatherNodeDiscoveries,
} from '@helpers/gather-node-discovery';
import { pruneInvalidMaterials } from '@helpers/materials';
import { pruneInvalidPartyEquipment } from '@helpers/party';
import { pruneInvalidDiscoveredRecipes } from '@helpers/recipes';
import { retrofitTradeskillXp } from '@helpers/tradeskill';
import { pruneInvalidWorldDiscoveries } from '@helpers/world-node-discovery';
import {
  gamestate,
  gamestateTickEnd,
  gamestateTickStart,
  saveGameState,
  setGameState,
} from '@helpers/state-game';
import { defaultOptions, options, setOptions } from '@helpers/state-options';
import { worldNodeByName, worldNodesOfType } from '@helpers/world-nodes';
import { merge } from 'es-toolkit/compat';
import type { GameStateDiscoveredGatherNodes, GameStateMaterials } from '@interfaces';

// One-time backfill for saves that predate gather-node discovery tracking:
// if the player already has material progress but no recorded node visits,
// treat every GatherNode as found rather than retroactively hiding
// materials they've legitimately already gathered. A save with neither
// materials nor discoveries is a genuinely fresh game, which should still
// start fully ungated.
function backfillLegacyGatherNodeDiscoveries(
  discoveredGatherNodes: GameStateDiscoveredGatherNodes,
  materials: GameStateMaterials,
): GameStateDiscoveredGatherNodes {
  const hasNoRecordedVisits = Object.keys(discoveredGatherNodes).length === 0;
  const hasExistingProgress = Object.keys(materials).length > 0;

  if (!hasNoRecordedVisits || !hasExistingProgress) return discoveredGatherNodes;

  return grandfatherGatherNodeDiscoveries(
    worldNodesOfType('GatherNode').map((entry) => entry.nodeName),
  );
}

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
  newState.discoveredGatherNodes = pruneInvalidGatherNodeDiscoveries(
    newState.discoveredGatherNodes,
    (nodeName) => !!worldNodeByName(nodeName),
  );
  newState.discoveredGatherNodes = backfillLegacyGatherNodeDiscoveries(
    newState.discoveredGatherNodes,
    newState.materials,
  );
  newState.worldDiscoveries = pruneInvalidWorldDiscoveries(
    newState.worldDiscoveries,
    (nodeName) => !!worldNodeByName(nodeName),
  );
  newState.bestiary = pruneInvalidBestiaryEntries(newState.bestiary);
  newState.bestiary = repairInvalidBestiaryLevels(newState.bestiary);
  newState.tradeskills = pruneInvalidCraftQueues(newState.tradeskills);
  newState.world.party = pruneInvalidPartyEquipment(newState.world.party);

  newState.world.party = retrofitPartyXp(newState.world.party);
  newState.tradeskills = retrofitTradeskillXp(newState.tradeskills);

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
