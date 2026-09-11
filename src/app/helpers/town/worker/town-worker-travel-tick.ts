import { TOWN_WORKER_REST_TICKS } from '@helpers/config';
import { travelStepTicksCost } from '@helpers/hero/travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { applyTownAccrueHiddenGold } from '@helpers/town/town-gold';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import type {
  CurrentLocation,
  PathAdvanceResult,
  TownContent,
  TownId,
  TravelStep,
  WorkerId,
} from '@interfaces';

// Structural fork, not shared state.
function advancePathOneTick(
  path: TravelStep[],
  ticksIntoStep: number,
  currentLocation: CurrentLocation,
): PathAdvanceResult {
  if (path.length === 0) return { arrived: true, location: currentLocation };

  const [currentStep, ...restOfPath] = path;
  const stepCost = travelStepTicksCost(currentStep, currentLocation);
  const newTicksIntoStep = ticksIntoStep + 1;

  if (stepCost > 0 && newTicksIntoStep < stepCost) {
    return {
      arrived: false,
      path,
      ticksIntoStep: newTicksIntoStep,
      location: currentLocation,
    };
  }

  const newLocation: CurrentLocation = {
    mapName: currentStep.mapName,
    x: currentStep.x,
    y: currentStep.y,
  };

  if (restOfPath.length === 0) return { arrived: true, location: newLocation };

  return {
    arrived: false,
    path: restOfPath,
    ticksIntoStep: 0,
    location: newLocation,
  };
}

function advanceTownWorkerTravelStatus(
  townId: TownId,
  workerId: WorkerId,
  path: TravelStep[],
  ticksIntoStep: number,
  location: CurrentLocation,
): PathAdvanceResult {
  const result = advancePathOneTick(path, ticksIntoStep, location);

  updateGamestate((state) => {
    const target = state.world.towns[townId]?.workers[workerId];
    if (!target) return state;

    target.location = result.location;
    if (
      !result.arrived &&
      (target.status.kind === 'TravelingTo' ||
        target.status.kind === 'TravelingBack')
    ) {
      target.status.path = result.path;
      target.status.ticksIntoStep = result.ticksIntoStep;
    }
    return state;
  });

  return result;
}

function processTravelingTo(townId: TownId, workerId: WorkerId): void {
  const worker = gamestate().world.towns[townId]?.workers[workerId];
  if (!worker || worker.status.kind !== 'TravelingTo') return;

  const { nodeName, itemId, path, ticksIntoStep } = worker.status;
  const result = advanceTownWorkerTravelStatus(
    townId,
    workerId,
    path,
    ticksIntoStep,
    worker.location,
  );
  if (!result.arrived) return;

  updateGamestate((state) => {
    const target = state.world.towns[townId]?.workers[workerId];
    if (!target) return state;

    target.status = {
      kind: 'Gathering',
      nodeName,
      itemId,
      itemsGathered: 0,
      ticksIntoGather: 0,
    };
    return state;
  });
}

function processTravelingBack(
  town: TownContent,
  townId: TownId,
  workerId: WorkerId,
): void {
  const worker = gamestate().world.towns[townId]?.workers[workerId];
  if (!worker || worker.status.kind !== 'TravelingBack') return;

  const { carriedItemId, carriedQuantity, path, ticksIntoStep } = worker.status;
  const result = advanceTownWorkerTravelStatus(
    townId,
    workerId,
    path,
    ticksIntoStep,
    worker.location,
  );
  if (!result.arrived) return;

  const goldPerMaterial = town.gathering.goldGatheredPerMaterial;

  updateGamestate((state) => {
    const target = state.world.towns[townId]?.workers[workerId];
    if (!target) return state;

    if (carriedItemId && carriedQuantity > 0) {
      applyTownAccrueHiddenGold(
        state,
        town,
        townId,
        carriedQuantity * goldPerMaterial,
      );
      applyTownMaterialDelta(state, townId, carriedItemId, carriedQuantity);
    }

    target.status = { kind: 'Resting', ticksIntoRest: 0 };
    target.assignment = null;
    return state;
  });
}

export function townWorkerTravelProcessTick(
  town: TownContent,
  workerId: WorkerId,
): void {
  const status =
    gamestate().world.towns[town.id]?.workers[workerId]?.status.kind;

  if (status === 'TravelingTo') {
    processTravelingTo(town.id, workerId);
    return;
  }

  if (status === 'TravelingBack') {
    processTravelingBack(town, town.id, workerId);
  }
}

// Resting bridges a completed haul-back and the next auto-assignment - a brief idle cooldown at town, not a trip.
export function townWorkerRestProcessTick(
  town: TownContent,
  workerId: WorkerId,
): void {
  const worker = gamestate().world.towns[town.id]?.workers[workerId];
  if (!worker || worker.status.kind !== 'Resting') return;

  const ticksIntoRest = worker.status.ticksIntoRest + 1;

  updateGamestate((state) => {
    const target = state.world.towns[town.id]?.workers[workerId];
    if (!target || target.status.kind !== 'Resting') return state;

    target.status =
      ticksIntoRest < TOWN_WORKER_REST_TICKS
        ? { kind: 'Resting', ticksIntoRest }
        : { kind: 'AtTown' };
    return state;
  });
}
