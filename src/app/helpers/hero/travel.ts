import { caravanMarkVisited } from '@helpers/caravan/caravan';
import { travelMessageLog } from '@helpers/combat/combat-log';
import { currentCombat } from '@helpers/combat/combat-state';
import { autoModeIsEnabled, autoModeToggle } from '@helpers/decree/auto-mode';
import { encounterStartFight } from '@helpers/encounter/encounter';
import { encounterRandomStartFight } from '@helpers/encounter/encounter-random-combat';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { mapNodeAutoShowOnArrival } from '@helpers/engine/ui';
import {
  addGlobalEffect,
  isGlobalEffectActive,
} from '@helpers/hero/global-effects';
import { gatherNodeDiscover } from '@helpers/item/gather-node-discovery';
import { gatheringStart, gatheringStop } from '@helpers/item/gathering';
import {
  mapHopsBetween,
  tileIsOnPath,
  travelPathTo,
} from '@helpers/pathfinding/pathfinding';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { currentLocationGet, currentLocationSet } from '@helpers/world';
import { worldNodeExploreRandomIsAvailable } from '@helpers/world-node/world-node-encounter';
import {
  worldNodeAt,
  worldNodeByName,
  worldNodeCaravan,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  GlobalEffectId,
  TravelState,
  TravelStep,
} from '@interfaces';
import { clamp, sum } from 'es-toolkit/compat';

export const TICKS_PER_STEP_ON_PATH = 1;
export const TICKS_PER_STEP_OFF_PATH = 3;
const DEATHS_DOOR_SECONDS_PER_MAP = 10;
const DEATHS_DOOR_MINIMUM_SECONDS = 10;

function travelGet(): TravelState {
  return gamestate().world.travel;
}

// A node's own tile counts as "on path" so arriving doesn't stutter with the off-path cost.
function travelTileCountsAsPath(
  mapName: string,
  x: number,
  y: number,
): boolean {
  return tileIsOnPath(mapName, x, y) || !!worldNodeAt(mapName, x, y);
}

// Teleport is instant. Move is cheap entering a path/node tile, or leaving a node tile -
// leaving an ordinary path tile is deliberately not discounted, or the off-path cost would never apply.
export function travelStepTicksCost(
  step: TravelStep,
  originTile: CurrentLocation,
): number {
  if (step.kind === 'Teleport') return 0;

  const enteringPathOrNode = travelTileCountsAsPath(
    step.mapName,
    step.x,
    step.y,
  );
  const exitingNode = !!worldNodeAt(
    originTile.mapName,
    originTile.x,
    originTile.y,
  );

  return enteringPathOrNode || exitingNode
    ? TICKS_PER_STEP_ON_PATH
    : TICKS_PER_STEP_OFF_PATH;
}

// Remaining seconds until arrival if actively traveling toward this node,
// else undefined - drives a disabled "mm:ss" travel button in the UI.
export function travelEtaSecondsTo(nodeName: string): number | undefined {
  const travel = travelGet();
  if (travel.status !== 'Traveling' || travel.destinationNodeName !== nodeName) {
    return undefined;
  }

  let origin = currentLocationGet();
  const costs = travel.path.map((step, index) => {
    const cost = travelStepTicksCost(step, origin);
    origin = step;
    return index === 0 ? clamp(cost - travel.ticksIntoStep, 0, cost) : cost;
  });

  return sum(costs);
}

// Sums a path's tick cost, threading each completed step as the next
// origin - mirrors the per-step costing `travelProcessTick` does live, just
// resolved all at once for a location that isn't ticking through it. Used by
// worker stamina-gating and the workerstamina analysis script, so this
// costing logic exists in exactly one place.
export function travelPathTotalTicks(
  path: TravelStep[],
  origin: CurrentLocation,
): number {
  let originTile = origin;
  const costs = path.map((step) => {
    const cost = travelStepTicksCost(step, originTile);
    originTile = { mapName: step.mapName, x: step.x, y: step.y };
    return cost;
  });

  return sum(costs);
}

// Deaths Door/Healing/active combat are the only true blockers - being mid-Travel is not,
// so the party can redirect to a new destination without arriving first.
export function canPartyTravel(): boolean {
  return (
    !isGlobalEffectActive('Deaths Door' as GlobalEffectId) &&
    !isGlobalEffectActive('Healing' as GlobalEffectId) &&
    !currentCombat()
  );
}

// Settles the party as arrived without moving - used when a redirect targets the tile they're already on.
function travelArriveWithoutMoving(destinationNodeName: string): void {
  const location = currentLocationGet();

  updateGamestate((state) => {
    state.world.travel = { status: 'Idle', path: [], ticksIntoStep: 0 };
    return state;
  });

  travelArriveAtNode(destinationNodeName, { kind: 'Move', ...location });
}

// Safety net for an unroutable tile (e.g. walled off by a map edit): recall to kingdom and log where it happened.
function travelRecoverFromPathingFailure(destinationNodeName: string): void {
  const location = currentLocationGet();
  const kingdom = worldNodesOfType('Kingdom')[0];

  if (kingdom) {
    currentLocationSet({
      mapName: kingdom.mapName,
      x: kingdom.x,
      y: kingdom.y,
    });
  }

  updateGamestate((state) => {
    state.world.travel = { status: 'Idle', path: [], ticksIntoStep: 0 };
    return state;
  });

  travelMessageLog(
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

  const travel = travelGet();
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

  analyticsSendDesignEvent('World:Travel:Start');
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

  travelMessageLog(
    currentLocationGet().mapName,
    wasTraveling
      ? `The party changed course for ${destinationNodeName}.`
      : `The party left for ${destinationNodeName}.`,
  );

  return true;
}

// 10 seconds per teleport-hop to the kingdom's map, 10 second minimum so dying nearby still costs a beat.
function deathsDoorDurationTicks(): number {
  const kingdom = worldNodesOfType('Kingdom')[0];
  if (!kingdom) return DEATHS_DOOR_MINIMUM_SECONDS;

  const hops = mapHopsBetween(currentLocationGet().mapName, kingdom.mapName);
  return Math.max(
    DEATHS_DOOR_MINIMUM_SECONDS,
    hops * DEATHS_DOOR_SECONDS_PER_MAP,
  );
}

// Deaths Door is purely a timer; on expiry (`globalEffectsProcessTick`) the party teleports to the kingdom.
export function travelBeginDeathsDoor(): void {
  addGlobalEffect('Deaths Door' as GlobalEffectId, deathsDoorDurationTicks());

  travelMessageLog(
    currentLocationGet().mapName,
    'The fallen party awaits recall to the kingdom.',
  );
}

function travelArriveAtNode(
  destinationNodeName: string | undefined,
  tile: TravelStep,
): void {
  if (!destinationNodeName) return;

  travelMessageLog(
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

// Chains through instant (0-tick) steps immediately so a run of Teleports never waits on ticks.
function travelCompleteStep(
  destinationNodeName: string | undefined,
  completedStep: TravelStep,
  remainingPath: TravelStep[],
): void {
  currentLocationSet({
    mapName: completedStep.mapName,
    x: completedStep.x,
    y: completedStep.y,
  });

  if (remainingPath.length === 0) {
    updateGamestate((state) => {
      state.world.travel = { status: 'Idle', path: [], ticksIntoStep: 0 };
      return state;
    });

    travelArriveAtNode(destinationNodeName, completedStep);
    return;
  }

  const [nextStep, ...restOfPath] = remainingPath;
  if (travelStepTicksCost(nextStep, completedStep) === 0) {
    travelCompleteStep(destinationNodeName, nextStep, restOfPath);
    return;
  }

  updateGamestate((state) => {
    state.world.travel.path = remainingPath;
    state.world.travel.ticksIntoStep = 0;
    return state;
  });
}

export function travelProcessTick(): void {
  const travel = travelGet();
  if (travel.status === 'Idle' || travel.path.length === 0) return;

  const [currentStep, ...restOfPath] = travel.path;
  const stepCost = travelStepTicksCost(currentStep, currentLocationGet());
  const ticksIntoStep = travel.ticksIntoStep + 1;

  if (stepCost > 0 && ticksIntoStep < stepCost) {
    updateGamestate((state) => {
      state.world.travel.ticksIntoStep = ticksIntoStep;
      return state;
    });
    return;
  }

  travelCompleteStep(travel.destinationNodeName, currentStep, restOfPath);
}
