import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/gather-vfx');
vi.mock('@helpers/pathfinding/pathfinding-travel');
vi.mock('@helpers/worker/worker-assignment');

import { combatLog } from '@helpers/combat/combat-log';
import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { getMaterialQuantity } from '@helpers/item/materials';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { workersState } from '@helpers/state-game';
import {
  workerAssignmentIsValid,
  workerGatherAssignmentIsValid,
} from '@helpers/worker/worker-assignment';
import {
  defaultWorkerState,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import {
  workerTripGatheringTick,
  workerTripTravelTick,
} from '@helpers/worker/worker-trip';
import { kingdomWorkerTripHost } from '@helpers/worker/worker-trip-kingdom';
import type {
  GameState,
  GatheringContent,
  GatheringId,
  ItemId,
  RecipeId,
  TravelStep,
  WorkerId,
  WorkerState,
  WorkerStatus,
  WorkerStatusGathering,
  WorkerStatusTravelingBack,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const nell = ensureWorker({
  id: 'weaver-nell' as WorkerId,
  name: 'Weaver Nell',
  baseStats: { capacity: 3, gatherSpeed: 2, craftSpeed: 0, stamina: 30 },
});
const copper = ensureItem({
  id: 'copper-ore' as ItemId,
  name: 'Copper Ore',
  sprite: 'copper-sprite',
});
const nodeName = 'Wergen Woods';
const assignment = { nodeName, itemId: copper.id };
const path: TravelStep[] = [1, 2, 3].map((x) => ({
  kind: 'Move',
  mapName: 'TestMap',
  x,
  y: 0,
}));

function woods(overrides: Partial<GatheringContent> = {}): GatheringContent {
  return ensureGathering({
    id: 'wergen-woods' as GatheringId,
    name: nodeName,
    gatherTime: 10,
    gatherResults: [
      ensureGatherResult({
        chance: 100,
        items: [{ itemId: copper.id, quantity: 1 }],
      }),
    ],
    workerLevelRange: { min: 1, max: 99 },
    ...overrides,
  });
}

function seedNodes(gathering = woods()): void {
  seedContent([nell, copper, gathering]);
  seedWorldNodes([
    { name: 'The Duchy', type: 'Kingdom' },
    { name: nodeName, type: 'GatherNode' },
  ]);
}

function seedWorker(
  status: WorkerStatus,
  overrides: Partial<WorkerState> = {},
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate((state) => {
    state.workers[nell.id] = {
      ...defaultWorkerState(),
      location: { mapName: 'TestMap', x: 0, y: 0 },
      status,
      ...overrides,
    };
    edit(state);
  });
}

function worker(): WorkerState {
  return workersState()[nell.id];
}

const gatherTick = () =>
  inTick(() => workerTripGatheringTick(kingdomWorkerTripHost(nell.id)));

const travelTick = () =>
  inTick(() => workerTripTravelTick(kingdomWorkerTripHost(nell.id)));

function tickWhile(still: () => boolean, tick: () => void): number {
  let ticks = 0;
  while (still()) {
    if (ticks >= 1000) throw new Error('condition never reached');
    tick();
    ticks += 1;
  }
  return ticks;
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

function ticksForOneUnit(): number {
  const gathered = () => {
    const { status } = worker();
    return status.kind === 'Gathering' ? status.itemsGathered : -1;
  };
  const start = gathered();
  return tickWhile(() => gathered() === start, gatherTick);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(workerAssignmentIsValid).mockReturnValue(true);
  vi.mocked(workerGatherAssignmentIsValid).mockReturnValue(true);
  vi.mocked(travelPathFrom).mockReturnValue(path);
  seedNodes();
});

describe('kingdom worker gathering', () => {
  it('builds up progress, then lands a unit with xp and a VFX, starting the next one fresh', () => {
    seedWorker(gathering(), { assignment });

    gatherTick();
    expect(worker().status).toMatchObject({
      ticksIntoGather: 1,
      itemsGathered: 0,
    });
    expect(worker().xp.current).toBe(0);

    ticksForOneUnit();

    expect(worker().status).toMatchObject({
      ticksIntoGather: 0,
      itemsGathered: 1,
    });
    expect(worker().xp.current).toBe(1);
    expect(gatherVfxEmit).toHaveBeenCalledWith({
      nodeName,
      name: copper.name,
      sprite: copper.sprite,
      spritesheet: 'item',
      quantity: 1,
    });
  });

  it('gathers faster on an upgraded node', () => {
    seedNodes(woods({ gatherReductionPerUpgradeLevel: 2 }));

    seedWorker(gathering(), { assignment });
    const base = ticksForOneUnit();
    seedWorker(gathering(), { assignment }, (state) => {
      state.gatherNodeLevels[nodeName] = { level: 2 };
    });

    expect(ticksForOneUnit()).toBeLessThan(base);
  });

  it('earns no xp outside the node’s worker level range', () => {
    seedNodes(woods({ workerLevelRange: { min: 5, max: 10 } }));
    seedWorker(gathering(), { assignment });

    ticksForOneUnit();

    expect(worker().xp.current).toBe(0);
  });

  it('heads home with a full load, showing the last unit only if the trip starts', () => {
    const full = workerStatsForLevel(nell, 1).capacity;
    const gatherUntilFull = () =>
      tickWhile(() => worker().status.kind === 'Gathering', gatherTick);

    seedWorker(gathering({ itemsGathered: full - 1 }), { assignment });
    gatherUntilFull();

    expect(worker().status).toEqual({
      kind: 'TravelingBack',
      path,
      ticksIntoStep: 0,
      carriedItemId: copper.id,
      carriedQuantity: full,
    });
    expect(gatherVfxEmit).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    vi.mocked(workerGatherAssignmentIsValid).mockReturnValue(true);
    vi.mocked(travelPathFrom).mockReturnValue(undefined);
    seedWorker(gathering({ itemsGathered: full - 1 }), { assignment });
    gatherUntilFull();

    expect(worker().status).toEqual({ kind: 'AtDuchy' });
    expect(gatherVfxEmit).not.toHaveBeenCalled();
  });

  it('parks the worker at the Duchy once its assignment goes stale', () => {
    vi.mocked(workerGatherAssignmentIsValid).mockReturnValue(false);
    seedWorker(gathering(), { assignment });

    gatherTick();

    expect(worker().status).toEqual({ kind: 'AtDuchy' });
    expect(worker().assignment).toBeNull();
  });
});

describe('kingdom worker travel', () => {
  const returning = (
    carried: Partial<WorkerStatusTravelingBack> = {},
  ): WorkerStatusTravelingBack => ({
    kind: 'TravelingBack',
    path,
    ticksIntoStep: 0,
    carriedItemId: copper.id,
    carriedQuantity: 5,
    ...carried,
  });

  const travelHome = () =>
    tickWhile(() => worker().status.kind === 'TravelingBack', travelTick);

  it('walks the path step by step, then starts gathering on arrival', () => {
    seedWorker({ kind: 'TravelingTo', ...assignment, path, ticksIntoStep: 0 });

    travelTick();
    expect(worker().status.kind).toBe('TravelingTo');

    tickWhile(() => worker().status.kind === 'TravelingTo', travelTick);

    expect(worker().location).toEqual({ mapName: 'TestMap', x: 3, y: 0 });
    expect(worker().status).toEqual(gathering());
  });

  it('drops off its haul at the Duchy, logging the return', () => {
    seedWorker(returning());

    travelHome();

    expect(worker().status).toEqual({ kind: 'AtDuchy' });
    expect(getMaterialQuantity(copper.id)).toBe(5);
    expect(combatLog()).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('Weaver Nell returned'),
        itemIcons: [{ sprite: copper.sprite, spritesheet: 'item' }],
      }),
    ]);
  });

  it('still drops off a haul whose item left content, without a log line', () => {
    seedWorker(returning());
    seedContent([nell]);

    travelHome();

    expect(getMaterialQuantity(copper.id)).toBe(5);
    expect(combatLog()).toEqual([]);
  });

  it('returns quietly with nothing carried', () => {
    [
      returning({ carriedItemId: undefined, carriedQuantity: 0 }),
      returning({ carriedQuantity: 0 }),
    ].forEach((status) => {
      seedWorker(status);
      travelHome();
    });

    expect(combatLog()).toEqual([]);
  });

  it('starts crafting at the Duchy on a still-valid craft assignment', () => {
    const craft = { recipeId: 'copper-ingot' as RecipeId };
    seedWorker(returning(), { assignment: craft });

    travelHome();

    expect(worker()).toMatchObject({
      assignment: craft,
      status: {
        kind: 'Crafting',
        recipeId: craft.recipeId,
        ticksIntoCraft: 0,
        materialsHeld: false,
      },
    });
  });

  it('drops a craft assignment that no longer qualifies on arrival', () => {
    vi.mocked(workerAssignmentIsValid).mockReturnValue(false);
    seedWorker(returning(), {
      assignment: { recipeId: 'copper-ingot' as RecipeId },
    });

    travelHome();

    expect(worker()).toMatchObject({
      assignment: null,
      status: { kind: 'AtDuchy' },
    });
  });

  it('heads straight back out on a still-valid assignment, else drops it', () => {
    seedWorker(returning(), { assignment, level: 7 });
    travelHome();
    expect(workerAssignmentIsValid).toHaveBeenCalledWith(
      nell.id,
      7,
      assignment,
    );
    expect(worker()).toMatchObject({
      assignment,
      status: { kind: 'TravelingTo', ...assignment, path, ticksIntoStep: 0 },
    });

    vi.mocked(workerAssignmentIsValid).mockReturnValue(false);
    seedWorker(returning(), { assignment });
    travelHome();
    expect(worker()).toMatchObject({
      assignment: null,
      status: { kind: 'AtDuchy' },
    });
  });
});
