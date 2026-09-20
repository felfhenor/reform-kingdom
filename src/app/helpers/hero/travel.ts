import { caravanMarkVisited } from '@helpers/caravan/caravan';
import { categoryMessageLog } from '@helpers/combat/combat-log';
import {
  DEATHS_DOOR_MINIMUM_SECONDS,
  DEATHS_DOOR_SECONDS_PER_MAP,
} from '@helpers/config';
import { autoModeIsEnabled, autoModeToggle } from '@helpers/decree/auto-mode';
import { encounterStartFight } from '@helpers/encounter/encounter';
import { encounterRandomStartFight } from '@helpers/encounter/encounter-random-combat';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { mapNodeAutoShowOnArrival } from '@helpers/engine/ui';
import {
  addGlobalEffect,
  isGlobalEffectActive,
} from '@helpers/hero/global-effects';
import { travelStepTicksCost } from '@helpers/hero/travel-cost';
import {
  travelProgressCovers,
  travelProgressSurplus,
  travelTicksRemaining,
} from '@helpers/hero/travel-progress';
import { gatherNodeDiscover } from '@helpers/item/gather-node-discovery';
import { gatheringStart, gatheringStop } from '@helpers/item/gathering';
import { mapHopsBetween } from '@helpers/pathfinding/pathfinding';
import { travelPathTo } from '@helpers/pathfinding/pathfinding-travel';
import {
  updateGamestate,
  worldCombatState,
  worldCurrentLocationState,
  worldTravelState,
} from '@helpers/state-game';
import { townReputationBuffSync } from '@helpers/town/reputation/town-reputation-buff';
import { homeNodeGet } from '@helpers/town/town-spawn';
import { currentLocationSet } from '@helpers/world';
import { worldNodeExploreRandomIsAvailable } from '@helpers/world-node/world-node-encounter';
import {
  isWorldNodeCollectibleGateMet,
  worldNodeByName,
  worldNodeCaravan,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { GlobalEffectId, TravelStep } from '@interfaces';

export {
  travelPathTotalTicks,
  travelStepTicksCost,
} from '@helpers/hero/travel-cost';

// Remaining seconds until arrival if actively traveling toward this node,
// else undefined - drives a disabled "mm:ss" travel button in the UI.
export function travelEtaSecondsTo(nodeName: string): number | undefined {
  const travel = worldTravelState();
  if (
    travel.status !== 'Traveling' ||
    travel.destinationNodeName !== nodeName
  ) {
    return undefined;
  }

  return travelTicksRemaining(
    travel.path,
    worldCurrentLocationState(),
    travel.ticksIntoStep,
  );
}

// Deaths Door/Healing/active combat are the only true blockers - being mid-Travel is not,
// so the party can redirect to a new destination without arriving first.
export function canPartyTravel(): boolean {
  return (
    !isGlobalEffectActive('Deaths Door' as GlobalEffectId) &&
    !isGlobalEffectActive('Healing' as GlobalEffectId) &&
    !worldCombatState()
  );
}

// Settles the party as arrived without moving - used when a redirect targets the tile they're already on.
function travelArriveWithoutMoving(destinationNodeName: string): void {
  const location = worldCurrentLocationState();

  updateGamestate((state) => {
    state.world.travel = { status: 'Idle', path: [], ticksIntoStep: 0 };
    return state;
  });

  travelArriveAtNode(destinationNodeName, { kind: 'Move', ...location });
}

// Safety net for an unroutable tile (e.g. walled off by a map edit): recall to kingdom and log where it happened.
function travelRecoverFromPathingFailure(destinationNodeName: string): void {
  const location = worldCurrentLocationState();
  const kingdom = worldNodesOfType('Kingdom')[0];

  if (kingdom) {
    currentLocationSet({
      mapName: kingdom.mapName,
      x: kingdom.x,
      y: kingdom.y,
    });
    townReputationBuffSync(location.mapName, kingdom.mapName);
  }

  updateGamestate((state) => {
    state.world.travel = { status: 'Idle', path: [], ticksIntoStep: 0 };
    return state;
  });

  categoryMessageLog(
    'Travel',
    location.mapName,
    `Pathing error: no route to ${destinationNodeName} could be found from ` +
      `${location.mapName} (${location.x}, ${location.y}). The party was recalled to the kingdom.`,
  );
}

// Manual travel fully disables Auto Mode (not just pauses it) - the player has taken the wheel back.
export function travelStart(
  destinationNodeName: string,
  isAutoMode = false,
): boolean {
  if (!isAutoMode && autoModeIsEnabled()) autoModeToggle(false);
  if (!canPartyTravel()) return false;

  const destinationEntry = worldNodeByName(destinationNodeName);
  if (destinationEntry && !isWorldNodeCollectibleGateMet(destinationEntry)) {
    return false;
  }

  const travel = worldTravelState();
  const wasTraveling = travel.status === 'Traveling';
  if (wasTraveling && travel.destinationNodeName === destinationNodeName) {
    return false;
  }

  const path = travelPathTo(destinationNodeName);
  if (!path) {
    travelRecoverFromPathingFailure(destinationNodeName);
    return false;
  }
  // Manual click on the current tile is a no-op (avoids stray re-triggers); Auto Mode falls
  // through instead, since it deliberately re-targets the node the party is already on.
  if (path.length === 0 && !wasTraveling && !isAutoMode) return false;

  analyticsSendDesignEvent(
    `World:Travel:Start:${analyticsSafeSegment(destinationNodeName)}`,
  );
  gatheringStop();

  if (path.length === 0) {
    travelArriveWithoutMoving(destinationNodeName);
    return true;
  }

  updateGamestate((state) => {
    state.world.travel = {
      status: 'Traveling',
      destinationNodeName,
      path,
      ticksIntoStep: 0,
    };
    return state;
  });

  categoryMessageLog(
    'Travel',
    worldCurrentLocationState().mapName,
    wasTraveling
      ? `The party changed course for ${destinationNodeName}.`
      : `The party left for ${destinationNodeName}.`,
  );

  return true;
}

// 10 seconds per teleport-hop to the home node's map (a designated Town, or the Duchy), 10 second minimum so dying nearby still costs a beat.
function deathsDoorDurationTicks(): number {
  const home = homeNodeGet();
  if (!home) return DEATHS_DOOR_MINIMUM_SECONDS;

  const hops = mapHopsBetween(
    worldCurrentLocationState().mapName,
    home.mapName,
  );
  return Math.max(
    DEATHS_DOOR_MINIMUM_SECONDS,
    hops * DEATHS_DOOR_SECONDS_PER_MAP,
  );
}

// Deaths Door is purely a timer; on expiry the party teleports home.
export function travelBeginDeathsDoor(): void {
  addGlobalEffect('Deaths Door' as GlobalEffectId, deathsDoorDurationTicks());

  categoryMessageLog(
    'Travel',
    worldCurrentLocationState().mapName,
    'The fallen party awaits recall home.',
  );
}

function travelArriveAtNode(
  destinationNodeName: string | undefined,
  tile: TravelStep,
): void {
  if (!destinationNodeName) return;

  categoryMessageLog(
    'Travel',
    tile.mapName,
    `The party has arrived at ${destinationNodeName}.`,
  );

  const node = worldNodeByName(destinationNodeName);
  if (!node) return;

  mapNodeAutoShowOnArrival(node);

  const caravan = worldNodeCaravan(node);
  if (caravan) caravanMarkVisited(caravan.id);

  const encounter = worldNodeEncounter(node);
  if (encounter) {
    encounterStartFight(encounter.id, 0, destinationNodeName);
    return;
  }

  const encounterRandom = worldNodeEncounterRandom(node);
  if (encounterRandom) {
    if (worldNodeExploreRandomIsAvailable(node)) {
      encounterRandomStartFight(node, 0);
    }
    return;
  }

  const gathering = worldNodeGathering(node);
  if (gathering) {
    gatherNodeDiscover(destinationNodeName);
    gatheringStart(destinationNodeName);
  }
}

// Chains into every following step the carried progress covers (incl. instant Teleports) within the same tick.
function travelCompleteStep(
  destinationNodeName: string | undefined,
  completedStep: TravelStep,
  remainingPath: TravelStep[],
  carriedProgress: number,
): void {
  const previousLocation = worldCurrentLocationState();
  currentLocationSet({
    mapName: completedStep.mapName,
    x: completedStep.x,
    y: completedStep.y,
  });
  townReputationBuffSync(previousLocation.mapName, completedStep.mapName);

  if (remainingPath.length === 0) {
    updateGamestate((state) => {
      state.world.travel = { status: 'Idle', path: [], ticksIntoStep: 0 };
      return state;
    });

    travelArriveAtNode(destinationNodeName, completedStep);
    return;
  }

  const [nextStep, ...restOfPath] = remainingPath;
  const nextCost = travelStepTicksCost(nextStep, completedStep);
  if (travelProgressCovers(carriedProgress, nextCost)) {
    travelCompleteStep(
      destinationNodeName,
      nextStep,
      restOfPath,
      travelProgressSurplus(carriedProgress, nextCost),
    );
    return;
  }

  updateGamestate((state) => {
    state.world.travel.path = remainingPath;
    state.world.travel.ticksIntoStep = carriedProgress;
    return state;
  });
}

export function travelProcessTick(): void {
  const travel = worldTravelState();
  if (travel.status === 'Idle' || travel.path.length === 0) return;

  const [currentStep, ...restOfPath] = travel.path;
  const stepCost = travelStepTicksCost(
    currentStep,
    worldCurrentLocationState(),
  );
  const progress = travel.ticksIntoStep + 1;

  if (!travelProgressCovers(progress, stepCost)) {
    updateGamestate((state) => {
      state.world.travel.ticksIntoStep = progress;
      return state;
    });
    return;
  }

  travelCompleteStep(
    travel.destinationNodeName,
    currentStep,
    restOfPath,
    travelProgressSurplus(progress, stepCost),
  );
}
