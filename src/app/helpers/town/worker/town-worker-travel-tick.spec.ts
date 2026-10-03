import { beforeEach, describe, expect, it } from 'vitest';

import { TOWN_WORKER_REST_TICKS } from '@helpers/config';
import { ensureItem } from '@helpers/content/ensure-item';
import {
  ensureTown,
  ensureTownGathering,
  ensureTownMaterialThreshold,
} from '@helpers/content/ensure-town';
import { worldTownsState } from '@helpers/state-game';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import {
  townWorkerRestProcessTick,
  townWorkerTravelProcessTick,
} from '@helpers/town/worker/town-worker-travel-tick';
import type {
  ItemId,
  TownContent,
  TownId,
  TownWorkerState,
  TownWorkerStatus,
  TravelStep,
  WorkerId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const workerId = 'darwin' as WorkerId;
const oreId = 'copper-ore' as ItemId;
const gold = ensureItem({ id: 'gold' as ItemId, name: 'Gold Coin' });
const assignment = { nodeName: 'Wergen Woods', itemId: oreId };
const goldCap = 50;

const larsia: TownContent = ensureTown({
  id: 'larsia' as TownId,
  name: 'Larsia',
  gathering: ensureTownGathering({ goldGatheredPerMaterial: 5 }),
  materialThresholds: [
    ensureTownMaterialThreshold({ itemId: gold.id, maxQuantity: goldCap }),
  ],
});

const path: TravelStep[] = [1, 2].map((x) => ({
  kind: 'Move',
  mapName: 'TestMap',
  x,
  y: 0,
}));

function seedWorker(
  status: TownWorkerStatus,
  overrides: Partial<TownWorkerState> = {},
): void {
  seedGamestate((state) => {
    state.world.towns[larsia.id] = buildTownNodeState({
      workers: {
        [workerId]: {
          ...defaultTownWorkerState(larsia, 1),
          location: { mapName: 'TestMap', x: 0, y: 0 },
          status,
          ...overrides,
        },
      },
    });
  });
}

function worker(): TownWorkerState {
  return worldTownsState()[larsia.id].workers[workerId];
}

const travelTick = () =>
  inTick(() => townWorkerTravelProcessTick(larsia, workerId));

function travelUntilArrived(): void {
  for (let i = 0; worker().status.kind.startsWith('Traveling'); i++) {
    if (i >= 1000) throw new Error('never arrived');
    travelTick();
  }
}

const returning = (carriedQuantity: number): TownWorkerStatus => ({
  kind: 'TravelingBack',
  path,
  ticksIntoStep: 0,
  carriedItemId: oreId,
  carriedQuantity,
});

beforeEach(() => {
  seedContent([larsia, gold]);
});

describe('townWorkerTravelProcessTick', () => {
  it('walks out step by step, then starts gathering on arrival', () => {
    seedWorker({ kind: 'TravelingTo', ...assignment, path, ticksIntoStep: 0 });

    travelTick();
    expect(worker().status.kind).toBe('TravelingTo');

    travelUntilArrived();

    expect(worker().location).toMatchObject({ x: 2 });
    expect(worker().status).toEqual({
      kind: 'Gathering',
      ...assignment,
      itemsGathered: 0,
      ticksIntoGather: 0,
    });
  });

  it('stocks the haul at the town, banking gold per material, then rests unassigned', () => {
    seedWorker(returning(4), { assignment });

    travelTick();
    expect(worker().status.kind).toBe('TravelingBack');
    expect(worldTownsState()[larsia.id].materials).toEqual({});

    travelUntilArrived();

    const town = worldTownsState()[larsia.id];
    expect(town.materials[oreId]).toBe(4);
    expect(town.hiddenGold).toBe(4 * larsia.gathering.goldGatheredPerMaterial);
    expect(worker()).toMatchObject({
      status: { kind: 'Resting', ticksIntoRest: 0 },
      assignment: null,
    });
  });

  it('banks no more hidden gold than the town’s gold cap, and still rests the worker after an empty haul', () => {
    seedWorker(returning(goldCap));
    travelUntilArrived();
    expect(worldTownsState()[larsia.id].hiddenGold).toBe(goldCap);

    seedWorker(returning(0), { assignment });
    travelUntilArrived();
    expect(worker()).toMatchObject({
      status: { kind: 'Resting', ticksIntoRest: 0 },
      assignment: null,
    });
  });
});

describe('townWorkerRestProcessTick', () => {
  const restTick = () =>
    inTick(() => townWorkerRestProcessTick(larsia, workerId));

  it('rests for the configured ticks, then is back at town', () => {
    seedWorker({ kind: 'Resting', ticksIntoRest: 0 });

    restTick();
    expect(worker().status).toEqual({ kind: 'Resting', ticksIntoRest: 1 });

    seedWorker({ kind: 'Resting', ticksIntoRest: TOWN_WORKER_REST_TICKS - 2 });
    restTick();
    expect(worker().status.kind).toBe('Resting');
    restTick();
    expect(worker().status).toEqual({ kind: 'AtTown' });
  });
});
