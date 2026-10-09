import { pruneInvalidCommissions } from '@helpers/commission/commission-tick';
import {
  craftQueueOrphanedEquipment,
  pruneInvalidCraftQueues,
} from '@helpers/crafting/crafting';
import { getEntry } from '@helpers/content/content';
import {
  migrateTradeskillStateKeys,
  retrofitTradeskillXp,
} from '@helpers/crafting/tradeskill';
import {
  backfillDecreeClauseRiskTolerance,
  pruneInvalidDecreeGatherClauses,
} from '@helpers/decree/decree';
import { defaultGameState } from '@helpers/defaults';
import { ledgerMark, ledgerPrune } from '@helpers/engine/ledger';
import { getMap } from '@helpers/maps';
import { retrofitPartyXp } from '@helpers/hero/character-progress';
import { recomputeGlobalEffectSums } from '@helpers/hero/global-effect-state';
import { pruneInvalidPartyEquipment } from '@helpers/hero/party';
import {
  grantFoundingStoneIfMissing,
  pruneInvalidCollectibles,
} from '@helpers/item/collectibles';
import {
  backfillEquipmentBlock,
  backfillEquipmentItem,
} from '@helpers/item/equipment';
import { grandfatherGatherNodeDiscoveries } from '@helpers/item/gather-node-discovery';
import { pruneInvalidMaterials } from '@helpers/item/materials';
import { pruneInvalidArmoryItems } from '@helpers/kingdom/armory';
import { pruneInvalidActiveAstralProjectorSpells } from '@helpers/kingdom/astral-projector';
import {
  pruneInvalidBestiaryEntries,
  repairInvalidBestiaryLevels,
} from '@helpers/kingdom/bestiary';
import { repairUnwalkableCurrentLocation } from '@helpers/pathfinding/pathfinding';
import { pruneInvalidHomeNode } from '@helpers/town/town-spawn';
import { pruneInvalidTowns } from '@helpers/town/town-prune';
import { pruneInvalidCharacterTeachings } from '@helpers/trainer/trainer';
import { pruneInvalidTasks, retrofitTasks } from '@helpers/task/task-migrate';
import { TUTORIAL_CATALOG } from '@helpers/tutorial/tutorial-catalog';
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
  pruneInvalidWorkerStates,
} from '@helpers/worker/worker-discovery';
import { workerAssignmentIsValid } from '@helpers/worker/worker-travel';
import { backfillDiscoveredMaps } from '@helpers/world-node/world-map-discovery';
import { allGatherableMaterialIds } from '@helpers/world-node/world-node-gathering';
import { pruneInvalidGatherNodeLevels } from '@helpers/world-node/world-node-level';
import { pruneInvalidWorldNodeDevelopmentLevels } from '@helpers/world-node/world-node-development';
import {
  worldNodeByName,
  worldNodeGathering,
  worldNodeOutpost,
  worldNodeShrine,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  AutoModeState,
  DecreeRiskLevel,
  GameState,
  GameStateDiscoveredGatherNodes,
  GameStateDiscoveredMaterials,
  GameStateMaterials,
  MaterialId,
} from '@interfaces';
import { merge } from 'es-toolkit/compat';

function contentExists(id: string): boolean {
  return !!getEntry(id);
}

// Backfill for pre-materials-discovery-tracking saves - anything currently held was obviously found already.
function backfillLegacyDiscoveredMaterials(
  discoveredMaterials: GameStateDiscoveredMaterials,
  materials: GameStateMaterials,
): GameStateDiscoveredMaterials {
  const backfilled = { ...discoveredMaterials };

  (Object.keys(materials) as MaterialId[]).forEach((materialId) => {
    ledgerMark(backfilled, materialId, materials[materialId].foundAt);
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

// Pre-ledger saves: every node the party stood at, fought at, or developed proves its map was visited.
function visitedNodeMapNames(state: GameState): string[] {
  const nodeNames = [
    ...Object.keys(state.discoveredGatherNodes),
    ...Object.keys(state.worldDiscoveries),
    ...Object.keys(state.shrines),
    ...Object.keys(state.outposts),
    ...Object.values(state.bestiary).flatMap((entry) => entry.foundAtNodes),
    ...(state.world.homeNodeName ? [state.world.homeNodeName] : []),
  ];

  return nodeNames.flatMap((nodeName) => {
    const mapName = worldNodeByName(nodeName)?.mapName;
    return mapName ? [mapName] : [];
  });
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
    teachings: pruneInvalidCharacterTeachings(character.teachings),
  }));

  newState.armory = pruneInvalidArmoryItems(newState.armory);
  newState.materials = pruneInvalidMaterials(newState.materials);
  newState.discoveredMaterials = ledgerPrune(
    newState.discoveredMaterials,
    contentExists,
  );
  newState.discoveredMaterials = backfillLegacyDiscoveredMaterials(
    newState.discoveredMaterials,
    newState.materials,
  );
  newState.discoveredEquipment = ledgerPrune(
    newState.discoveredEquipment,
    contentExists,
  );
  newState.discoveredCaravans = ledgerPrune(
    newState.discoveredCaravans,
    contentExists,
  );
  newState.discoveredTrainers = ledgerPrune(
    newState.discoveredTrainers,
    contentExists,
  );
  newState.world.commissions = pruneInvalidCommissions(
    newState.world.commissions,
  );
  newState.world.towns = pruneInvalidTowns(newState.world.towns);
  newState.world.homeNodeName = pruneInvalidHomeNode(
    newState.world.homeNodeName,
  );
  newState.collectibles = pruneInvalidCollectibles(newState.collectibles);
  newState.collectibles = grantFoundingStoneIfMissing(newState.collectibles);
  newState.discoveredRecipes = ledgerPrune(
    newState.discoveredRecipes,
    contentExists,
  );
  newState.discoveredGatherNodes = ledgerPrune(
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
  newState.shrines = pruneInvalidWorldNodeDevelopmentLevels(
    newState.shrines,
    (nodeName) => {
      const node = worldNodeByName(nodeName);
      return node ? worldNodeShrine(node) : undefined;
    },
  );
  newState.outposts = pruneInvalidWorldNodeDevelopmentLevels(
    newState.outposts,
    (nodeName) => {
      const node = worldNodeByName(nodeName);
      return node ? worldNodeOutpost(node) : undefined;
    },
  );
  newState.worldDiscoveries = ledgerPrune(
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
  newState.discoveredWorkers = ledgerPrune(
    newState.discoveredWorkers,
    isWorkerContentKnown,
  );
  newState.tutorials = ledgerPrune(newState.tutorials, (id) =>
    TUTORIAL_CATALOG.some((t) => t.id === id),
  );
  newState.workers = pruneInvalidWorkerStates(
    newState.workers,
    workerAssignmentIsValid,
  );
  newState.armory = [
    ...newState.armory,
    ...craftQueueOrphanedEquipment(newState.tradeskills),
  ];
  newState.tradeskills = pruneInvalidCraftQueues(newState.tradeskills);
  newState.world.party = pruneInvalidPartyEquipment(newState.world.party);
  newState.world.currentLocation = repairUnwalkableCurrentLocation(
    newState.world.currentLocation,
  );
  newState.discoveredMaps = backfillDiscoveredMaps(newState.discoveredMaps, [
    newState.world.currentLocation.mapName,
    ...visitedNodeMapNames(newState),
  ]);
  newState.discoveredMaps = ledgerPrune(
    newState.discoveredMaps,
    (mapName) => !!getMap(mapName),
  );

  newState.world.party = retrofitPartyXp(newState.world.party);
  newState.tradeskills = retrofitTradeskillXp(newState.tradeskills);

  newState.discoveredAstralProjectorSpells = ledgerPrune(
    newState.discoveredAstralProjectorSpells,
    contentExists,
  );
  newState.activeAstralProjectorSpells =
    pruneInvalidActiveAstralProjectorSpells(
      newState.activeAstralProjectorSpells,
    );

  newState.tasks = pruneInvalidTasks(newState.tasks);
  newState.tasks = retrofitTasks(newState);

  // Always recomputed fresh on load - guards against saves predating this field, and
  // against authored effects changing on content the save already owns/has active.
  recomputeGlobalEffectSums(newState);

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
