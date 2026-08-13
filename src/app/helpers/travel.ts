import { autoModeIsEnabled, autoModeToggle } from '@helpers/auto-mode';
import { addGlobalEffect, isGlobalEffectActive } from '@helpers/global-effects';
import { encounterStartFight } from '@helpers/encounter';
import { encounterRandomStartFight } from '@helpers/encounter-random-combat';
import { gatherNodeDiscover } from '@helpers/gather-node-discovery';
import { travelMessageLog } from '@helpers/combat-log';
import { gatheringStart, gatheringStop } from '@helpers/gathering';
import { mapHopsBetween, travelPathTo } from '@helpers/pathfinding';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { currentLocationGet, currentLocationSet } from '@helpers/world';
import { worldNodeExploreRandomIsAvailable } from '@helpers/world-node-encounter';
import {
  worldNodeByName,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type { GlobalEffectId, TravelState, TravelStep } from '@interfaces';

export const TICKS_PER_STEP_MOVE = 3;
const DEATHS_DOOR_SECONDS_PER_MAP = 10;
const DEATHS_DOOR_MINIMUM_SECONDS = 10;

function travelGet(): TravelState {
  return gamestate().world.travel;
}

// Crossing a TeleportNode is instant (0 ticks) - only plain Move steps pay
// the per-tile cost.
function ticksPerStepFor(step: TravelStep): number {
  return step.kind === 'Teleport' ? 0 : TICKS_PER_STEP_MOVE;
}

// Deaths Door/Healing are the only true blockers - being mid-Travel is not,
// so the party can redirect to a new destination without arriving first.
export function canPartyTravel(): boolean {
  return (
    !isGlobalEffectActive('Deaths Door' as GlobalEffectId) &&
    !isGlobalEffectActive('Healing' as GlobalEffectId)
  );
}

// Settles the party as arrived at `destinationNodeName` without moving them -
// used when a mid-travel redirect targets the tile they're already standing
// on (e.g. redirecting back to the node they just departed, before its first
// step has resolved).
function travelArriveWithoutMoving(destinationNodeName: string): void {
  const location = currentLocationGet();

  updateGamestate((state) => {
    state.world.travel = { status: 'Idle', path: [], ticksIntoStep: 0 };
    return state;
  });

  travelArriveAtNode(destinationNodeName, { kind: 'Move', ...location });
}

// Safety net: if pathfinding can't produce a route at all (e.g. the party's
// current tile got walled off by a map edit), they'd otherwise be stuck on
// that tile forever with no way to travel anywhere. Recall them to the
// kingdom and log exactly where it happened so the underlying map issue can
// be diagnosed.
function travelRecoverFromPathingFailure(destinationNodeName: string): void {
  const location = currentLocationGet();
  const kingdom = worldNodesOfType('Kingdom')[0];

  if (kingdom) {
    currentLocationSet({ mapName: kingdom.mapName, x: kingdom.x, y: kingdom.y });
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

// A manually-initiated travel (isAutoMode = false, the default) always wins
// over standing orders - it fully disables Auto Mode rather than merely
// pausing it, per design: the player has taken the wheel back.
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
  // A manual click on the tile the party is already standing on is a no-op
  // (prevents accidental re-triggering from a stray click). Auto Mode
  // deliberately re-targets the same node this way, though - e.g. the
  // nearest eligible node for a LevelUpParty/FinishUnfinishedAreas clause is
  // often the one the party just fought at - so it needs to fall through to
  // `travelArriveWithoutMoving` below and actually re-trigger the node.
  if (path.length === 0 && !wasTraveling && !isAutoMode) return false;

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

// How long Deaths Door lasts: 10 seconds per teleport-hop between the map
// the party died on and the kingdom's map, 10 seconds minimum (so dying right
// next to the kingdom still costs a beat, not an instant recall).
function deathsDoorDurationTicks(): number {
  const kingdom = worldNodesOfType('Kingdom')[0];
  if (!kingdom) return DEATHS_DOOR_MINIMUM_SECONDS;

  const hops = mapHopsBetween(currentLocationGet().mapName, kingdom.mapName);
  return Math.max(
    DEATHS_DOOR_MINIMUM_SECONDS,
    hops * DEATHS_DOOR_SECONDS_PER_MAP,
  );
}

// The party doesn't walk home when defeated - Deaths Door is purely a timer;
// on expiry (see `globalEffectsProcessTick`) they're teleported straight to
// the kingdom and healing begins there.
export function travelBeginDeathsDoor(): void {
  addGlobalEffect(
    'Deaths Door' as GlobalEffectId,
    deathsDoorDurationTicks(),
  );

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

  travelMessageLog(tile.mapName, `The party has arrived at ${destinationNodeName}.`);

  const node = worldNodeByName(destinationNodeName);
  if (!node) return;

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

// Completes `completedStep` and either continues on to the next step -
// resolving it immediately too if it's also instant (a chain of Teleport
// steps should never wait for extra ticks) - or finishes the trip.
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
  if (ticksPerStepFor(nextStep) === 0) {
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
  const stepCost = ticksPerStepFor(currentStep);
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
