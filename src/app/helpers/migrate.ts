import { pruneInvalidDiscoveredCaravans } from '@helpers/caravan/caravan';
import { pruneInvalidCommissions } from '@helpers/commission/commission-tick';
import { pruneInvalidCraftQueues } from '@helpers/crafting/crafting';
import { pruneInvalidDiscoveredRecipes } from '@helpers/crafting/recipes';
import {
  migrateTradeskillStateKeys,
  retrofitTradeskillXp,
} from '@helpers/crafting/tradeskill';
import {
  backfillDecreeClauseRiskTolerance,
  pruneInvalidDecreeGatherClauses,
} from '@helpers/decree/decree';
import { defaultGameState } from '@helpers/defaults';
import { retrofitPartyXp } from '@helpers/hero/character-progress';
import { pruneInvalidPartyEquipment } from '@helpers/hero/party';
import {
  grantFoundingStoneIfMissing,
  pruneInvalidCollectibles,
} from '@helpers/item/collectibles';
import {
  backfillEquipmentBlock,
  backfillEquipmentItem,
} from '@helpers/item/equipment';
import {
  grandfatherGatherNodeDiscoveries,
  pruneInvalidGatherNodeDiscoveries,
} from '@helpers/item/gather-node-discovery';
import {
  pruneInvalidDiscoveredMaterials,
  pruneInvalidMaterials,
} from '@helpers/item/materials';
import {
  pruneInvalidArmoryItems,
  pruneInvalidDiscoveredEquipment,
} from '@helpers/kingdom/armory';
import {
  pruneInvalidActiveAstralProjectorSpells,
  pruneInvalidDiscoveredAstralProjectorSpells,
} from '@helpers/kingdom/astral-projector';
import {
  pruneInvalidBestiaryEntries,
  repairInvalidBestiaryLevels,
} from '@helpers/kingdom/bestiary';
import { repairUnwalkableCurrentLocation } from '@helpers/pathfinding/pathfinding';
import {
  gamestate,
  gamestateTickEnd,
  gamestateTickStart,
  saveGameState,
  setGameState,
} from '@helpers/state-game';
import { defaultOptions, options, setOptions } from '@helpers/state-options';
import {
  isWorkerContentKnown,
  pruneInvalidDiscoveredWorkers,
  pruneInvalidWorkerStates,
} from '@helpers/worker/worker-discovery';
import { workerAssignmentIsValid } from '@helpers/worker/worker-travel';
import { pruneInvalidWorldDiscoveries } from '@helpers/world-node/world-node-discovery';
import { allGatherableMaterialIds } from '@helpers/world-node/world-node-gathering';
import { pruneInvalidGatherNodeLevels } from '@helpers/world-node/world-node-level';
import {
  worldNodeByName,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  AutoModeState,
  DecreeRiskLevel,
  GameStateDiscoveredGatherNodes,
  GameStateDiscoveredMaterials,
  GameStateMaterials,
  MaterialId,
} from '@interfaces';
import { merge } from 'es-toolkit/compat';

// Backfill for pre-materials-discovery-tracking saves - anything currently held was obviously found already.
function backfillLegacyDiscoveredMaterials(
  discoveredMaterials: GameStateDiscoveredMaterials,
  materials: GameStateMaterials,
): GameStateDiscoveredMaterials {
  const backfilled = { ...discoveredMaterials };

  (Object.keys(materials) as MaterialId[]).forEach((materialId) => {
    backfilled[materialId] ??= { foundAt: materials[materialId].foundAt };
  });

  return backfilled;
}

// Backfill for pre-discovery-tracking saves: existing material progress with no recorded visits means treat every GatherNode as found.
function backfillLegacyGatherNodeDiscoveries(
  discoveredGatherNodes: GameStateDiscoveredGatherNodes,
  materials: GameStateMaterials,
): GameStateDiscoveredGatherNodes {
  const hasNoRecordedVisits = Object.keys(discoveredGatherNodes).length === 0;
  const hasExistingProgress = Object.keys(materials).length > 0;

  if (!hasNoRecordedVisits || !hasExistingProgress)
    return discoveredGatherNodes;

  return grandfatherGatherNodeDiscoveries(
    worldNodesOfType('GatherNode').map((entry) => entry.nodeName),
  );
}

export function migrateGameState() {
  const state = gamestate();
  const remappedState = {
    ...state,
    tradeskills: migrateTradeskillStateKeys(state.tradeskills ?? {}),
  };
  const newState = merge(defaultGameState(), remappedState);

  // Pre-per-clause-risk saves stored this on `world.autoMode` directly; the field no longer exists on `AutoModeState`.
  const legacyAutoMode = newState.world.autoMode as AutoModeState & {
    riskTolerance?: DecreeRiskLevel;
  };
  const legacyRiskTolerance = legacyAutoMode.riskTolerance ?? 'Medium';
  delete legacyAutoMode.riskTolerance;

  newState.armory = newState.armory.map(backfillEquipmentItem);
  newState.world.party = newState.world.party.map((character) => ({
    ...character,
    equipment: backfillEquipmentBlock(character.equipment),
    combatOrders: character.combatOrders ?? {},
  }));

  newState.armory = pruneInvalidArmoryItems(newState.armory);
  newState.materials = pruneInvalidMaterials(newState.materials);
  newState.discoveredMaterials = pruneInvalidDiscoveredMaterials(
    newState.discoveredMaterials,
  );
  newState.discoveredMaterials = backfillLegacyDiscoveredMaterials(
    newState.discoveredMaterials,
    newState.materials,
  );
  newState.discoveredEquipment = pruneInvalidDiscoveredEquipment(
    newState.discoveredEquipment,
  );
  newState.discoveredCaravans = pruneInvalidDiscoveredCaravans(
    newState.discoveredCaravans,
  );
  newState.world.commissions = pruneInvalidCommissions(
    newState.world.commissions,
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
  newState.gatherNodeLevels = pruneInvalidGatherNodeLevels(
    newState.gatherNodeLevels,
    (nodeName) => {
      const node = worldNodeByName(nodeName);
      return node ? worldNodeGathering(node) : undefined;
    },
  );
  newState.worldDiscoveries = pruneInvalidWorldDiscoveries(
    newState.worldDiscoveries,
    (nodeName) => !!worldNodeByName(nodeName),
  );
  newState.world.autoMode.clauses = pruneInvalidDecreeGatherClauses(
    newState.world.autoMode.clauses,
    allGatherableMaterialIds(),
  );
  newState.world.autoMode.clauses = backfillDecreeClauseRiskTolerance(
    newState.world.autoMode.clauses,
    legacyRiskTolerance,
  );
  newState.bestiary = pruneInvalidBestiaryEntries(newState.bestiary);
  newState.bestiary = repairInvalidBestiaryLevels(newState.bestiary);
  newState.discoveredWorkers = pruneInvalidDiscoveredWorkers(
    newState.discoveredWorkers,
    isWorkerContentKnown,
  );
  newState.workers = pruneInvalidWorkerStates(
    newState.workers,
    workerAssignmentIsValid,
  );
  newState.tradeskills = pruneInvalidCraftQueues(newState.tradeskills);
  newState.world.party = pruneInvalidPartyEquipment(newState.world.party);
  newState.world.currentLocation = repairUnwalkableCurrentLocation(
    newState.world.currentLocation,
  );

  newState.world.party = retrofitPartyXp(newState.world.party);
  newState.tradeskills = retrofitTradeskillXp(newState.tradeskills);

  newState.discoveredAstralProjectorSpells =
    pruneInvalidDiscoveredAstralProjectorSpells(
      newState.discoveredAstralProjectorSpells,
    );
  newState.activeAstralProjectorSpells =
    pruneInvalidActiveAstralProjectorSpells(
      newState.activeAstralProjectorSpells,
    );

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
