import { backfillDiscoveredTraders } from '@helpers/caravan/caravan';
import { pruneInvalidCommissions } from '@helpers/commission/commission-tick';
import {
  craftQueueOrphanedEquipment,
  pruneInvalidCraftQueues,
} from '@helpers/crafting/crafting';
import { contentExists } from '@helpers/content/content';
import {
  migrateTradeskillStateKeys,
  retrofitTradeskillXp,
} from '@helpers/crafting/tradeskill';
import {
  backfillDecreeClauseRiskTolerance,
  pruneInvalidDecreeGatherClauses,
} from '@helpers/decree/decree';
import { defaultGameState, GAMESTATE_VERSION } from '@helpers/defaults';
import { ledgerMark } from '@helpers/engine/ledger';
import { recordPrune } from '@helpers/engine/record';
import { getMap } from '@helpers/maps';
import { retrofitPartyXp } from '@helpers/hero/character-progress';
import { recomputeGlobalEffectSums } from '@helpers/hero/global-effect-state';
import { pruneInvalidPartyEquipment } from '@helpers/hero/party';
import { grantFoundingStoneIfMissing } from '@helpers/item/collectibles';
import {
  backfillEquipmentBlock,
  backfillEquipmentItem,
  repairSplitEquippedItems,
} from '@helpers/item/equipment';
import { grandfatherGatherNodeDiscoveries } from '@helpers/item/gather-node-discovery';
import { applyMaterialDelta } from '@helpers/item/materials';
import { pruneInvalidArmoryItems } from '@helpers/kingdom/armory';
import { pruneInvalidActiveAstralProjectorSpells } from '@helpers/kingdom/astral-projector';
import { repairInvalidBestiaryLevels } from '@helpers/kingdom/bestiary';
import { repairUnwalkableCurrentLocation } from '@helpers/pathfinding/pathfinding';
import { pruneInvalidHomeNode } from '@helpers/town/town-spawn';
import { pruneInvalidTowns } from '@helpers/town/town-prune';
import { pruneInvalidBurstSkills } from '@helpers/hero/burst-skill';
import { stateRegaliaMigrate } from '@helpers/hero/regalia-state';
import { pruneInvalidCharacterTeachings } from '@helpers/trainer/trainer';
import { characterSkillTreesMigrate } from '@helpers/hero/skill-tree';
import { retrofitTasks } from '@helpers/task/task-migrate';
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
import { workerCraftOrphanedMaterials } from '@helpers/worker/worker-crafting';
import { workerAssignmentIsValid } from '@helpers/worker/worker-assignment';
import { backfillDiscoveredMaps } from '@helpers/world-node/world-map-discovery';
import { allGatherableMaterialIds } from '@helpers/world-node/world-node-gathering';
import { pruneInvalidWorldNodeDevelopmentLevels } from '@helpers/world-node/world-node-development';
import {
  WORLD_NODE_DEVELOPABLE_TYPES,
  WORLD_NODE_DEVELOPMENT_SLICES,
  worldNodeDevelopable,
} from '@helpers/world-node/world-node-development-state';
import {
  worldNodeByName,
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
// Version-gated because a new game's starting gold alone would otherwise look like legacy progress.
function backfillLegacyGatherNodeDiscoveries(
  discoveredGatherNodes: GameStateDiscoveredGatherNodes,
  materials: GameStateMaterials,
  version: number,
): GameStateDiscoveredGatherNodes {
  const isLegacySave = version < 2;
  const hasNoRecordedVisits = Object.keys(discoveredGatherNodes).length === 0;
  const hasExistingProgress = Object.keys(materials).length > 0;

  if (!isLegacySave || !hasNoRecordedVisits || !hasExistingProgress)
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
    burstSkills: pruneInvalidBurstSkills(character.burstSkills),
    ...characterSkillTreesMigrate(character),
  }));
  newState.world.party = newState.world.party.map((character) => {
    const { equipment, extras } = repairSplitEquippedItems(character.equipment);
    newState.armory.push(...extras);
    return { ...character, equipment };
  });
  stateRegaliaMigrate(newState);

  newState.armory = pruneInvalidArmoryItems(newState.armory);
  newState.materials = recordPrune(newState.materials, contentExists);
  newState.discoveredMaterials = recordPrune(
    newState.discoveredMaterials,
    contentExists,
  );
  newState.discoveredMaterials = backfillLegacyDiscoveredMaterials(
    newState.discoveredMaterials,
    newState.materials,
  );
  newState.discoveredEquipment = recordPrune(
    newState.discoveredEquipment,
    contentExists,
  );
  newState.discoveredCaravans = recordPrune(
    newState.discoveredCaravans,
    contentExists,
  );
  newState.discoveredTraders = backfillDiscoveredTraders(
    newState.discoveredTraders,
    newState.world.caravans,
  );
  newState.discoveredTraders = recordPrune(
    newState.discoveredTraders,
    contentExists,
  );
  newState.discoveredTrainers = recordPrune(
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
  newState.collectibles = recordPrune(newState.collectibles, contentExists);
  newState.collectibles = grantFoundingStoneIfMissing(newState.collectibles);
  newState.discoveredRecipes = recordPrune(
    newState.discoveredRecipes,
    contentExists,
  );
  newState.discoveredGatherNodes = recordPrune(
    newState.discoveredGatherNodes,
    (nodeName) => !!worldNodeByName(nodeName),
  );
  newState.discoveredGatherNodes = backfillLegacyGatherNodeDiscoveries(
    newState.discoveredGatherNodes,
    newState.materials,
    newState.meta.version,
  );
  newState.meta.version = GAMESTATE_VERSION;
  WORLD_NODE_DEVELOPABLE_TYPES.forEach((type) => {
    const slice = WORLD_NODE_DEVELOPMENT_SLICES[type];
    newState[slice] = pruneInvalidWorldNodeDevelopmentLevels(
      newState[slice],
      (nodeName) => {
        const content = worldNodeDevelopable(nodeName);
        return content?.__type === type ? content : undefined;
      },
    );
  });
  newState.worldDiscoveries = recordPrune(
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
  newState.bestiary = recordPrune(newState.bestiary, contentExists);
  newState.bestiary = repairInvalidBestiaryLevels(newState.bestiary);
  newState.discoveredWorkers = recordPrune(
    newState.discoveredWorkers,
    isWorkerContentKnown,
  );
  newState.tutorials = recordPrune(newState.tutorials, (id) =>
    TUTORIAL_CATALOG.some((t) => t.id === id),
  );
  const prunedWorkers = pruneInvalidWorkerStates(
    newState.workers,
    workerAssignmentIsValid,
  );
  workerCraftOrphanedMaterials(newState.workers, prunedWorkers).forEach(
    ({ itemId, quantity }) => applyMaterialDelta(newState, itemId, quantity),
  );
  newState.workers = prunedWorkers;
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
  newState.discoveredMaps = recordPrune(
    newState.discoveredMaps,
    (mapName) => !!getMap(mapName),
  );
  newState.regionIntros = recordPrune(
    newState.regionIntros,
    (mapName) => !!getMap(mapName),
  );

  newState.world.party = retrofitPartyXp(newState.world.party);
  newState.tradeskills = retrofitTradeskillXp(newState.tradeskills);

  newState.discoveredAstralProjectorSpells = recordPrune(
    newState.discoveredAstralProjectorSpells,
    contentExists,
  );
  newState.activeAstralProjectorSpells =
    pruneInvalidActiveAstralProjectorSpells(
      newState.activeAstralProjectorSpells,
    );

  newState.tasks = recordPrune(newState.tasks, contentExists);
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
  delete (newState as Partial<Record<string, unknown>>)['uiTheme'];

  setOptions(newState);
}
