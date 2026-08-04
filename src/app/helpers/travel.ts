import { addGlobalEffect, isGlobalEffectActive } from '@helpers/global-effects';
import { encounterStartFight } from '@helpers/encounter';
import { travelMessageLog } from '@helpers/combat-log';
import { gatheringStart, gatheringStop } from '@helpers/gathering';
import { mapHopsBetween, travelPathTo } from '@helpers/pathfinding';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { currentLocationGet, currentLocationSet } from '@helpers/world';
import {
  worldNodeByName,
  worldNodeEncounter,
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

export function canPartyTravel(): boolean {
  return (
    travelGet().status === 'Idle' &&
    !isGlobalEffectActive('Deaths Door' as GlobalEffectId) &&
    !isGlobalEffectActive('Healing' as GlobalEffectId)
  );
}

export function travelStart(destinationNodeName: string): boolean {
  if (!canPartyTravel()) return false;

  const path = travelPathTo(destinationNodeName);
  if (!path || path.length === 0) return false;

  gatheringStop();

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
    `The party left for ${destinationNodeName}.`,
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

  const gathering = worldNodeGathering(node);
  if (gathering) {
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
