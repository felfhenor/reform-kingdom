import { beforeEach, describe, expect, it } from 'vitest';

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { workersState } from '@helpers/state-game';
import {
  defaultWorkerState,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import {
  workerTripBeginOutbound,
  workerTripBeginReturn,
  workerTripGatheringTick,
  workerTripTravelTick,
} from '@helpers/worker/worker-trip';
import type {
  GatheringId,
  ItemId,
  TravelStep,
  WorkerId,
  WorkerState,
  WorkerStatus,
  WorkerTripHost,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const nell = ensureWorker({
  id: 'weaver-nell' as WorkerId,
  name: 'Weaver Nell',
  baseStats: { capacity: 3, gatherSpeed: 2, craftSpeed: 0, stamina: 30 },
});
const copper = ensureItem({ id: 'copper-ore' as ItemId, name: 'Copper Ore' });
const nodeName = 'Wergen Woods';
const assignment = { nodeName, itemId: copper.id };
const path: TravelStep[] = [1, 2].map((x) => ({
  kind: 'Move',
  mapName: 'TestMap',
  x,
  y: 0,
}));

// A host on the kingdom slot whose hooks log the worker's status at call time, so the engine's ordering is visible.
function stubHost(overrides: Partial<WorkerTripHost<WorkerState>> = {}) {
  const calls: string[] = [];
  const statusNow = () => workersState()[nell.id]?.status.kind;
  const host: WorkerTripHost<WorkerState> = {
    workerId: nell.id,
    read: () => workersState()[nell.id],
    draft: (state) => state.workers[nell.id],
    setStatus: (worker, status) => {
      worker.status = status === 'idle' ? { kind: 'AtDuchy' } : status;
    },
    setAssignment: (worker, value) => {
      worker.assignment = value;
    },
    assignmentIsValid: () => true,
    pathTo: () => path,
    pathHome: () => path,
    gatherRateMultiplier: 1,
    onUnitGathered: () => calls.push(`gathered while ${statusNow()}`),
    onUnitBanked: () => calls.push(`banked while ${statusNow()}`),
    onArrivedHome: (cargo, pending, level) =>
      calls.push(
        `home with ${cargo.quantity} ${cargo.itemId}, ${JSON.stringify(pending)}, Lv ${level}`,
      ),
    ...overrides,
  };
  return { host, calls };
}

function seedWorker(
  status: WorkerStatus,
  overrides: Partial<WorkerState> = {},
) {
  seedGamestate((state) => {
    state.workers[nell.id] = {
      ...defaultWorkerState(),
      location: { mapName: 'TestMap', x: 0, y: 0 },
      status,
      assignment,
      ...overrides,
    };
  });
}

const worker = () => workersState()[nell.id];

function tickWhile(still: () => boolean, tick: () => void): number {
  let ticks = 0;
  while (still()) {
    if (ticks >= 1000) throw new Error('condition never reached');
    tick();
    ticks += 1;
  }
  return ticks;
}

const gathering = (itemsGathered = 0): WorkerStatus => ({
  kind: 'Gathering',
  ...assignment,
  itemsGathered,
  ticksIntoGather: 0,
});

const itemsGathered = () => {
  const { status } = worker();
  return status.kind === 'Gathering' ? status.itemsGathered : -1;
};

beforeEach(() => {
  seedContent([
    nell,
    copper,
    ensureGathering({
      id: 'woods' as GatheringId,
      name: nodeName,
      gatherTime: 10,
      gatherResults: [
        ensureGatherResult({
          chance: 100,
          items: [{ itemId: copper.id, quantity: 1 }],
        }),
      ],
    }),
  ]);
  seedWorldNodes([{ name: nodeName, type: 'GatherNode' }]);
});

describe('workerTripGatheringTick', () => {
  it('reports a gathered unit while still gathering, then banks it', () => {
    const { host, calls } = stubHost();
    seedWorker(gathering());

    tickWhile(
      () => itemsGathered() === 0,
      () => inTick(() => workerTripGatheringTick(host)),
    );

    expect(calls).toEqual([
      'gathered while Gathering',
      'banked while Gathering',
    ]);
    expect(worker().status).toMatchObject({
      itemsGathered: 1,
      ticksIntoGather: 0,
    });
  });

  it('scales the rate by the host’s multiplier', () => {
    const ticksForOneUnit = (gatherRateMultiplier: number) => {
      const { host } = stubHost({ gatherRateMultiplier });
      seedWorker(gathering());
      return tickWhile(
        () => itemsGathered() === 0,
        () => inTick(() => workerTripGatheringTick(host)),
      );
    };

    expect(ticksForOneUnit(2)).toBeLessThan(ticksForOneUnit(1));
  });

  it('checks capacity after reporting the unit, banking it only once the trip home resolves', () => {
    const full = workerStatsForLevel(nell, 1).capacity;
    const gatherUntilDone = (host: WorkerTripHost<WorkerState>) =>
      tickWhile(
        () => worker().status.kind === 'Gathering',
        () => inTick(() => workerTripGatheringTick(host)),
      );

    const resolved = stubHost();
    seedWorker(gathering(full - 1));
    gatherUntilDone(resolved.host);
    expect(resolved.calls).toEqual([
      'gathered while Gathering',
      'banked while TravelingBack',
    ]);
    expect(worker().status).toMatchObject({
      kind: 'TravelingBack',
      carriedItemId: copper.id,
      carriedQuantity: full,
    });

    const stranded = stubHost({ pathHome: () => undefined });
    seedWorker(gathering(full - 1));
    gatherUntilDone(stranded.host);
    expect(stranded.calls).toEqual(['gathered while Gathering']);
    expect(worker().status).toEqual({ kind: 'AtDuchy' });
  });

  it('abandons an invalid assignment: idle, unassigned, nothing reported', () => {
    const { host, calls } = stubHost({ assignmentIsValid: () => false });
    seedWorker(gathering());

    inTick(() => workerTripGatheringTick(host));

    expect(worker()).toMatchObject({
      status: { kind: 'AtDuchy' },
      assignment: null,
    });
    expect(calls).toEqual([]);
  });
});

describe('workerTripTravelTick', () => {
  it('starts a fresh gather on reaching the node', () => {
    const { host } = stubHost();
    seedWorker({ kind: 'TravelingTo', ...assignment, path, ticksIntoStep: 0 });

    tickWhile(
      () => worker().status.kind === 'TravelingTo',
      () => inTick(() => workerTripTravelTick(host)),
    );

    expect(worker().status).toEqual(gathering());
  });

  it('hands arrival home to the host with the pre-step cargo, assignment and level, without idling the worker itself', () => {
    const { host, calls } = stubHost();
    seedWorker(
      {
        kind: 'TravelingBack',
        path,
        ticksIntoStep: 0,
        carriedItemId: copper.id,
        carriedQuantity: 2,
      },
      { level: 4 },
    );

    for (let i = 0; calls.length === 0; i++) {
      if (i >= 1000) throw new Error('never arrived');
      inTick(() => workerTripTravelTick(host));
    }

    expect(calls).toEqual([
      `home with 2 ${copper.id}, ${JSON.stringify(assignment)}, Lv 4`,
    ]);
    expect(worker().status.kind).toBe('TravelingBack');
  });
});

describe('workerTripBeginOutbound / workerTripBeginReturn', () => {
  it('sets the assignment and heads out, or leaves the worker untouched with no route', () => {
    seedWorker({ kind: 'AtDuchy' }, { assignment: null });
    inTick(() => workerTripBeginOutbound(stubHost().host, assignment));
    expect(worker()).toMatchObject({
      assignment,
      status: { kind: 'TravelingTo', ...assignment, path, ticksIntoStep: 0 },
    });

    seedWorker({ kind: 'AtDuchy' }, { assignment: null });
    inTick(() =>
      workerTripBeginOutbound(
        stubHost({ pathTo: () => undefined }).host,
        assignment,
      ),
    );
    expect(worker()).toMatchObject({
      assignment: null,
      status: { kind: 'AtDuchy' },
    });
  });

  it('routes home from where the worker stands, idling and dropping cargo when no route resolves', () => {
    const from: unknown[] = [];
    const { host } = stubHost({
      pathHome: (location) => {
        from.push(location);
        return path;
      },
    });
    seedWorker(gathering(2), { location: { mapName: 'TestMap', x: 5, y: 5 } });

    expect(
      inTick(() =>
        workerTripBeginReturn(host, { itemId: copper.id, quantity: 2 }),
      ),
    ).toBe(true);
    expect(from).toEqual([{ mapName: 'TestMap', x: 5, y: 5 }]);

    seedWorker(gathering(2));
    expect(
      inTick(() =>
        workerTripBeginReturn(stubHost({ pathHome: () => undefined }).host, {
          itemId: copper.id,
          quantity: 2,
        }),
      ),
    ).toBe(false);
    expect(worker().status).toEqual({ kind: 'AtDuchy' });
  });
});
