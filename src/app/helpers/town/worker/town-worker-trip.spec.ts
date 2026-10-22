import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/gather-vfx');
vi.mock('@helpers/pathfinding/pathfinding-travel');

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { worldTownsState } from '@helpers/state-game';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import { townWorkerTripHost } from '@helpers/town/worker/town-worker-trip';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import {
  workerTripGatheringTick,
  workerTripTravelTick,
} from '@helpers/worker/worker-trip';
import type {
  GameState,
  GatheringContent,
  GatheringId,
  ItemId,
  TownContent,
  TownId,
  TownWorkerState,
  TownWorkerStatus,
  TravelStep,
  WorkerId,
  WorkerStatusGathering,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const darwin = ensureWorker({
  id: 'darwin' as WorkerId,
  name: 'Darwin',
  baseStats: { capacity: 2, gatherSpeed: 1, craftSpeed: 0, stamina: 20 },
});
const ore = ensureItem({ id: 'copper-ore' as ItemId, name: 'Copper Ore' });
const gold = ensureItem({ id: 'gold' as ItemId, name: 'Gold Coin' });
const nodeName = 'Wergen Woods';
const assignment = { nodeName, itemId: ore.id };
const goldCap = 50;
const path: TravelStep[] = [1, 2].map((x) => ({
  kind: 'Move',
  mapName: 'TestMap',
  x,
  y: 0,
}));

function town(gatherRateMultiplier = 1): TownContent {
  return ensureTown({
    id: 'larsia' as TownId,
    name: 'Larsia',
    gathering: { gatherRateMultiplier, goldGatheredPerMaterial: 5 },
    materialThresholds: [{ itemId: gold.id, maxQuantity: goldCap }],
  });
}

function woods(overrides: Partial<GatheringContent> = {}): GatheringContent {
  return ensureGathering({
    id: 'wergen-woods' as GatheringId,
    name: nodeName,
    gatherTime: 10,
    gatherResults: [
      ensureGatherResult({
        chance: 100,
        items: [{ itemId: ore.id, quantity: 1 }],
      }),
    ],
    ...overrides,
  });
}

function seedNodes(gathering = woods()): void {
  seedContent([darwin, ore, gold, town(), gathering]);
  seedWorldNodes([
    { name: 'Larsia', type: 'NonPlayerKingdom' },
    { name: nodeName, type: 'GatherNode' },
  ]);
}

// Every route from or back to the town is the short test path; false means no route.
function routesResolve(resolve = true): void {
  vi.mocked(travelPathFrom).mockReturnValue(resolve ? path : undefined);
}

function seedWorker(
  content: TownContent,
  status: TownWorkerStatus,
  overrides: Partial<TownWorkerState> = {},
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate((state) => {
    state.world.towns[content.id] = buildTownNodeState({
      workers: {
        [darwin.id]: {
          ...defaultTownWorkerState(content, 1),
          location: { mapName: 'TestMap', x: 0, y: 0 },
          status,
          assignment,
          ...overrides,
        },
      },
    });
    edit(state);
  });
}

const gathering = (
  status: Partial<WorkerStatusGathering> = {},
): WorkerStatusGathering => ({
  kind: 'Gathering',
  ...assignment,
  itemsGathered: 0,
  ticksIntoGather: 0,
  ...status,
});

function worker(content: TownContent): TownWorkerState {
  return worldTownsState()[content.id].workers[darwin.id];
}

const gatherTick = (content: TownContent) =>
  inTick(() => workerTripGatheringTick(townWorkerTripHost(content, darwin.id)));

const travelTick = (content: TownContent) =>
  inTick(() => workerTripTravelTick(townWorkerTripHost(content, darwin.id)));

function tickWhile(
  still: () => boolean,
  tick: () => void,
  limit = 1000,
): number {
  let ticks = 0;
  while (still()) {
    if (ticks >= limit) throw new Error('condition never reached');
    tick();
    ticks += 1;
  }
  return ticks;
}

function ticksForOneUnit(content: TownContent): number {
  const gathered = () => {
    const { status } = worker(content);
    return status.kind === 'Gathering' ? status.itemsGathered : -1;
  };
  const start = gathered();
  return tickWhile(
    () => gathered() === start,
    () => gatherTick(content),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  routesResolve();
  seedNodes();
});

describe('town worker gathering', () => {
  it('builds up progress, then lands a unit and starts the next one fresh, with no xp or VFX', () => {
    const larsia = town();
    seedWorker(larsia, gathering());

    gatherTick(larsia);
    expect(worker(larsia).status).toMatchObject({
      ticksIntoGather: 1,
      itemsGathered: 0,
    });

    ticksForOneUnit(larsia);

    expect(worker(larsia).status).toMatchObject({
      kind: 'Gathering',
      ticksIntoGather: 0,
      itemsGathered: 1,
    });
    expect(worker(larsia).level).toBe(1);
    expect(gatherVfxEmit).not.toHaveBeenCalled();
  });

  it('gathers faster in a busier town and on an upgraded node', () => {
    const base = town();
    seedWorker(base, gathering());
    const baseTicks = ticksForOneUnit(base);

    const busy = town(2);
    seedWorker(busy, gathering());
    expect(ticksForOneUnit(busy)).toBeLessThan(baseTicks);

    seedNodes(woods({ gatherReductionPerUpgradeLevel: 2 }));
    seedWorker(base, gathering(), {}, (state) => {
      state.gatherNodeLevels[nodeName] = { level: 2 };
    });
    expect(ticksForOneUnit(base)).toBeLessThan(baseTicks);
  });

  it('heads home with a full load', () => {
    const larsia = town();
    const full = workerStatsForLevel(darwin, 1).capacity;
    seedWorker(larsia, gathering({ itemsGathered: full - 1 }));

    tickWhile(
      () => worker(larsia).status.kind === 'Gathering',
      () => gatherTick(larsia),
    );

    expect(worker(larsia).status).toEqual({
      kind: 'TravelingBack',
      path,
      ticksIntoStep: 0,
      carriedItemId: ore.id,
      carriedQuantity: full,
    });
  });

  it('parks the worker at town once its assignment goes stale', () => {
    const larsia = town();
    seedWorker(larsia, gathering());
    routesResolve(false);

    gatherTick(larsia);

    expect(worker(larsia)).toMatchObject({
      status: { kind: 'AtTown' },
      assignment: null,
    });
  });
});

describe('town worker travel', () => {
  const returning = (carriedQuantity: number): TownWorkerStatus => ({
    kind: 'TravelingBack',
    path,
    ticksIntoStep: 0,
    carriedItemId: ore.id,
    carriedQuantity,
  });

  const travelHome = (content: TownContent) =>
    tickWhile(
      () => worker(content).status.kind === 'TravelingBack',
      () => travelTick(content),
    );

  it('walks out step by step, then starts gathering on arrival', () => {
    const larsia = town();
    seedWorker(larsia, {
      kind: 'TravelingTo',
      ...assignment,
      path,
      ticksIntoStep: 0,
    });

    travelTick(larsia);
    expect(worker(larsia).status.kind).toBe('TravelingTo');

    tickWhile(
      () => worker(larsia).status.kind === 'TravelingTo',
      () => travelTick(larsia),
    );

    expect(worker(larsia).location).toMatchObject({ x: 2 });
    expect(worker(larsia).status).toEqual(gathering());
  });

  it('stocks the haul at the town, banking gold per material, then rests unassigned', () => {
    const larsia = town();
    seedWorker(larsia, returning(4));

    travelTick(larsia);
    expect(worker(larsia).status.kind).toBe('TravelingBack');
    expect(worldTownsState()[larsia.id].materials).toEqual({});

    travelHome(larsia);

    const state = worldTownsState()[larsia.id];
    expect(state.materials[ore.id]).toBe(4);
    expect(state.hiddenGold).toBe(4 * larsia.gathering.goldGatheredPerMaterial);
    expect(worker(larsia)).toMatchObject({
      status: { kind: 'Resting', ticksIntoRest: 0 },
      assignment: null,
    });
  });

  it('banks no more hidden gold than the town’s gold cap, and still rests the worker after an empty haul', () => {
    const larsia = town();
    seedWorker(larsia, returning(goldCap));
    travelHome(larsia);
    expect(worldTownsState()[larsia.id].hiddenGold).toBe(goldCap);

    seedWorker(larsia, returning(0));
    travelHome(larsia);
    expect(worker(larsia)).toMatchObject({
      status: { kind: 'Resting', ticksIntoRest: 0 },
      assignment: null,
    });
  });
});
