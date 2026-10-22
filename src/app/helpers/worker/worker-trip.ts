import { getEntry } from '@helpers/content/content';
import { travelPathAdvanceTick } from '@helpers/hero/travel-progress';
import { updateGamestate } from '@helpers/state-game';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import {
  applyWorkerGatherProgress,
  applyWorkerGatherUnit,
  applyWorkerTravelAdvance,
  workerGatherNodeContent,
  workerGatherRate,
  workerGatherTickOutcome,
  workerGatheringStatusStart,
} from '@helpers/worker/worker-shared';
import { gatheringEffectiveGatherTime } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import type {
  CurrentLocation,
  ItemId,
  PathAdvanceResult,
  TravelStep,
  WorkerContent,
  WorkerGatherAssignment,
  WorkerId,
  WorkerTripCargo,
  WorkerTripHost,
  WorkerTripWorker,
} from '@interfaces';

function workerCanUseTeleports(workerId: WorkerId): boolean {
  return getEntry<WorkerContent>(workerId)?.canUseTeleports ?? true;
}

// Parks the worker idle at home with no assignment - the defensive fallback when content changed mid-session.
export function workerTripAbandonGather<W extends WorkerTripWorker>(
  host: WorkerTripHost<W>,
): void {
  updateGamestate((state) => {
    const target = host.draft(state);
    if (!target) return state;

    host.setStatus(target, 'idle');
    host.setAssignment(target, null);

    return state;
  });
}

// No-ops (leaves the worker where it is) if no route resolves from the roster's home.
export function workerTripBeginOutbound<W extends WorkerTripWorker>(
  host: WorkerTripHost<W>,
  assignment: WorkerGatherAssignment,
): void {
  const path = host.pathTo(
    assignment.nodeName,
    workerCanUseTeleports(host.workerId),
  );
  if (!path) return;

  updateGamestate((state) => {
    const target = host.draft(state);
    if (!target) return state;

    host.setAssignment(target, assignment);
    host.setStatus(target, {
      kind: 'TravelingTo',
      nodeName: assignment.nodeName,
      itemId: assignment.itemId,
      path,
      ticksIntoStep: 0,
    });

    return state;
  });
}

// Path is resolved outside the update so the result is known even when the update is deferred (out-of-tick recall).
// Returns whether a route home resolved - false parks the worker idle in place with its cargo discarded.
export function workerTripBeginReturn<W extends WorkerTripWorker>(
  host: WorkerTripHost<W>,
  cargo: WorkerTripCargo,
): boolean {
  const worker = host.read();
  const path = worker
    ? host.pathHome(worker.location, workerCanUseTeleports(host.workerId))
    : undefined;

  updateGamestate((state) => {
    const target = host.draft(state);
    if (!target) return state;

    host.setStatus(
      target,
      path
        ? {
            kind: 'TravelingBack',
            path,
            ticksIntoStep: 0,
            carriedItemId: cargo.itemId,
            carriedQuantity: cargo.quantity,
          }
        : 'idle',
    );

    return state;
  });

  return !!path;
}

function workerTripCompleteGatherUnit<W extends WorkerTripWorker>(
  host: WorkerTripHost<W>,
  nodeName: string,
  itemId: ItemId,
  itemsGathered: number,
  capacity: number,
): void {
  if (itemsGathered >= capacity) {
    const startedTrip = workerTripBeginReturn(host, {
      itemId,
      quantity: itemsGathered,
    });
    if (startedTrip) host.onUnitBanked?.(nodeName, itemId);
    return;
  }

  host.onUnitBanked?.(nodeName, itemId);

  updateGamestate((state) => {
    const target = host.draft(state);
    if (target) applyWorkerGatherUnit(target, itemsGathered);
    return state;
  });
}

export function workerTripGatheringTick<W extends WorkerTripWorker>(
  host: WorkerTripHost<W>,
): void {
  const worker = host.read();
  const status = worker?.status;
  if (!worker || !status || status.kind !== 'Gathering') return;

  const { nodeName, itemId } = status;
  if (!host.assignmentIsValid(worker.level, { nodeName, itemId })) {
    workerTripAbandonGather(host);
    return;
  }

  const content = getEntry<WorkerContent>(host.workerId);
  const gathering = workerGatherNodeContent(nodeName);
  if (!content || !gathering) return;

  const nodeLevel = worldNodeLevel(nodeName);
  const rate =
    workerGatherRate(content, worker.level, gathering, itemId, nodeLevel) *
    host.gatherRateMultiplier;
  if (rate <= 0) return;

  const outcome = workerGatherTickOutcome(
    status,
    rate,
    gatheringEffectiveGatherTime(gathering, nodeLevel),
  );
  if (outcome.kind === 'Progress') {
    updateGamestate((state) => {
      const target = host.draft(state);
      if (target) applyWorkerGatherProgress(target, outcome.ticksIntoGather);
      return state;
    });
    return;
  }

  host.onUnitGathered?.(nodeName, itemId, worker.level);

  const capacity = workerStatsForLevel(content, worker.level).capacity;
  workerTripCompleteGatherUnit(
    host,
    nodeName,
    itemId,
    outcome.itemsGathered,
    capacity,
  );
}

function workerTripAdvance<W extends WorkerTripWorker>(
  host: WorkerTripHost<W>,
  path: TravelStep[],
  ticksIntoStep: number,
  location: CurrentLocation,
): PathAdvanceResult {
  const result = travelPathAdvanceTick(path, ticksIntoStep, location);

  updateGamestate((state) => {
    const target = host.draft(state);
    if (target) applyWorkerTravelAdvance(target, result);
    return state;
  });

  return result;
}

function workerTripTravelingTo<W extends WorkerTripWorker>(
  host: WorkerTripHost<W>,
  worker: W,
): void {
  if (worker.status.kind !== 'TravelingTo') return;

  const { nodeName, itemId, path, ticksIntoStep } = worker.status;
  const result = workerTripAdvance(host, path, ticksIntoStep, worker.location);
  if (!result.arrived) return;

  updateGamestate((state) => {
    const target = host.draft(state);
    if (target) {
      host.setStatus(target, workerGatheringStatusStart(nodeName, itemId));
    }
    return state;
  });
}

// Cargo, assignment and level are read before the step, then handed to the roster - arriving home is roster-specific.
function workerTripTravelingBack<W extends WorkerTripWorker>(
  host: WorkerTripHost<W>,
  worker: W,
): void {
  if (worker.status.kind !== 'TravelingBack') return;

  const { carriedItemId, carriedQuantity, path, ticksIntoStep } = worker.status;
  const pending = worker.assignment;
  const level = worker.level;

  const result = workerTripAdvance(host, path, ticksIntoStep, worker.location);
  if (!result.arrived) return;

  host.onArrivedHome(
    { itemId: carriedItemId, quantity: carriedQuantity },
    pending,
    level,
  );
}

export function workerTripTravelTick<W extends WorkerTripWorker>(
  host: WorkerTripHost<W>,
): void {
  const worker = host.read();
  if (!worker) return;

  if (worker.status.kind === 'TravelingTo') {
    workerTripTravelingTo(host, worker);
    return;
  }

  if (worker.status.kind === 'TravelingBack') {
    workerTripTravelingBack(host, worker);
  }
}
