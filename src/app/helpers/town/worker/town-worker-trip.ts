import { updateGamestate, worldTownsState } from '@helpers/state-game';
import { applyTownAccrueHiddenGold } from '@helpers/town/town-gold';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import {
  townWorkerAssignmentIsValid,
  townWorkerTravelPath,
} from '@helpers/town/worker/town-worker-travel';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  TownContent,
  TownWorkerState,
  WorkerId,
  WorkerTripCargo,
  WorkerTripHost,
} from '@interfaces';

// One update: hauled goods become town materials + hidden gold, then the worker rests and drops its assignment.
function townWorkerArrivedHome(
  town: TownContent,
  workerId: WorkerId,
  cargo: WorkerTripCargo,
): void {
  const goldPerMaterial = town.gathering.goldGatheredPerMaterial;

  updateGamestate((state) => {
    if (!state.world.towns[town.id]?.workers[workerId]) return state;

    if (cargo.itemId && cargo.quantity > 0) {
      applyTownAccrueHiddenGold(
        state,
        town,
        town.id,
        cargo.quantity * goldPerMaterial,
      );
      applyTownMaterialDelta(state, town.id, cargo.itemId, cargo.quantity);
    }

    const target = state.world.towns[town.id]?.workers[workerId];
    if (!target) return state;

    target.status = { kind: 'Resting', ticksIntoRest: 0 };
    target.assignment = null;

    return state;
  });
}

// Trips start from and return to the town's own node, scaled by the town's gather rate.
export function townWorkerTripHost(
  town: TownContent,
  workerId: WorkerId,
): WorkerTripHost<TownWorkerState> {
  return {
    workerId,
    read: () => worldTownsState()[town.id]?.workers[workerId],
    draft: (state) => state.world.towns[town.id]?.workers[workerId],
    setStatus: (worker, status) => {
      worker.status = status === 'idle' ? { kind: 'AtTown' } : status;
    },
    setAssignment: (worker, assignment) => {
      worker.assignment = assignment;
    },
    assignmentIsValid: (level, assignment) =>
      townWorkerAssignmentIsValid(town, workerId, level, assignment),
    pathTo: (nodeName, canUseTeleports) => {
      const townNode = worldNodeByName(town.name);
      return townNode
        ? townWorkerTravelPath(townNode, nodeName, canUseTeleports)
        : undefined;
    },
    pathHome: (from, canUseTeleports) =>
      townWorkerTravelPath(from, town.name, canUseTeleports),
    gatherRateMultiplier: town.gathering.gatherRateMultiplier,
    onArrivedHome: (cargo) => townWorkerArrivedHome(town, workerId, cargo),
  };
}
