import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/worker/worker-travel');

import { combatLog } from '@helpers/combat/combat-log';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { getMaterialQuantity } from '@helpers/item/materials';
import { workersState } from '@helpers/state-game';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import {
  workerAssignmentIsValid,
  workerBeginOutboundTrip,
} from '@helpers/worker/worker-travel';
import { workerTravelProcessTick } from '@helpers/worker/worker-travel-tick';
import type {
  ItemId,
  TravelStep,
  WorkerId,
  WorkerState,
  WorkerStatus,
} from '@interfaces';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedContent } from '@/testing/content';

const nell = ensureWorker({
  id: 'weaver-nell' as WorkerId,
  name: 'Weaver Nell',
});
const copper = ensureItem({
  id: 'copper-ore' as ItemId,
  name: 'Copper Ore',
  sprite: 'copper-sprite',
});
const assignment = { nodeName: 'Wergen Woods', itemId: copper.id };

const path: TravelStep[] = [1, 2, 3].map((x) => ({
  kind: 'Move',
  mapName: 'TestMap',
  x,
  y: 0,
}));

function seedTraveler(
  status: WorkerStatus,
  overrides: Partial<WorkerState> = {},
): void {
  seedGamestate((state) => {
    state.workers[nell.id] = {
      ...defaultWorkerState(),
      location: { mapName: 'TestMap', x: 0, y: 0 },
      status,
      ...overrides,
    };
  });
}

function worker(): WorkerState {
  return workersState()[nell.id];
}

const tick = () => inTick(() => workerTravelProcessTick(nell.id));

function travelUntilArrived(): void {
  for (let i = 0; worker().status.kind.startsWith('Traveling'); i++) {
    if (i >= 1000) throw new Error('never arrived');
    tick();
  }
}

type ReturningStatus = Extract<WorkerStatus, { kind: 'TravelingBack' }>;

const returning = (
  carried: Partial<ReturningStatus> = {},
): ReturningStatus => ({
  kind: 'TravelingBack',
  path,
  ticksIntoStep: 0,
  carriedItemId: copper.id,
  carriedQuantity: 5,
  ...carried,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(workerAssignmentIsValid).mockReturnValue(true);
  seedContent([nell, copper]);
});

describe('workerTravelProcessTick', () => {
  it('walks the path step by step, then starts gathering on arrival', () => {
    seedTraveler({
      kind: 'TravelingTo',
      ...assignment,
      path,
      ticksIntoStep: 0,
    });

    tick();
    expect(worker().status.kind).toBe('TravelingTo');

    travelUntilArrived();

    expect(worker().location).toEqual({ mapName: 'TestMap', x: 3, y: 0 });
    expect(worker().status).toEqual({
      kind: 'Gathering',
      ...assignment,
      itemsGathered: 0,
      ticksIntoGather: 0,
    });
  });

  it('drops off its haul at the Duchy, logging the return', () => {
    seedTraveler(returning());

    travelUntilArrived();

    expect(worker().status).toEqual({ kind: 'AtDuchy' });
    expect(getMaterialQuantity(copper.id)).toBe(5);
    expect(combatLog()).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('Weaver Nell returned'),
        itemIcons: [{ sprite: copper.sprite, spritesheet: 'item' }],
      }),
    ]);
    expect(workerBeginOutboundTrip).not.toHaveBeenCalled();
  });

  it('still drops off a haul whose item left content, without a log line', () => {
    seedTraveler(returning());
    seedContent([nell]);

    travelUntilArrived();

    expect(getMaterialQuantity(copper.id)).toBe(5);
    expect(combatLog()).toEqual([]);
  });

  it('returns quietly with nothing carried', () => {
    [
      returning({ carriedItemId: undefined, carriedQuantity: 0 }),
      returning({ carriedQuantity: 0 }),
    ].forEach((status) => {
      seedTraveler(status);
      travelUntilArrived();
    });

    expect(combatLog()).toEqual([]);
  });

  it('heads straight back out on a still-valid assignment, else drops it', () => {
    seedTraveler(returning(), { assignment, level: 7 });
    travelUntilArrived();
    expect(workerAssignmentIsValid).toHaveBeenCalledWith(
      nell.id,
      7,
      assignment,
    );
    expect(workerBeginOutboundTrip).toHaveBeenCalledWith(nell.id, assignment);
    expect(worker().assignment).toEqual(assignment);

    vi.clearAllMocks();
    vi.mocked(workerAssignmentIsValid).mockReturnValue(false);
    seedTraveler(returning(), { assignment });
    travelUntilArrived();
    expect(workerBeginOutboundTrip).not.toHaveBeenCalled();
    expect(worker().assignment).toBeNull();
  });
});
