import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/gather-vfx');
vi.mock('@helpers/worker/worker-travel');

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { workersState } from '@helpers/state-game';
import {
  workerGatherXpGateSatisfied,
  workerGatheringProcessTick,
} from '@helpers/worker/worker-gathering';
import {
  defaultWorkerState,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import {
  workerAssignmentIsValid,
  workerBeginReturnTrip,
} from '@helpers/worker/worker-travel';
import type {
  GameState,
  GatheringContent,
  GatheringId,
  ItemId,
  WorkerId,
  WorkerState,
  WorkerStatusGathering,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const nell = ensureWorker({
  id: 'weaver-nell' as WorkerId,
  name: 'Weaver Nell',
  baseStats: { capacity: 3, gatherSpeed: 2, stamina: 30 },
});
const copper = ensureItem({
  id: 'copper-ore' as ItemId,
  name: 'Copper Ore',
  sprite: 'copper-sprite',
});
const nodeName = 'Wergen Woods';

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

function seedGatherer(
  status: Partial<WorkerStatusGathering> = {},
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate((state) => {
    state.workers[nell.id] = {
      ...defaultWorkerState(),
      status: {
        kind: 'Gathering',
        nodeName,
        itemId: copper.id,
        itemsGathered: 0,
        ticksIntoGather: 0,
        ...status,
      },
      assignment: { nodeName, itemId: copper.id },
    };
    edit(state);
  });
}

function worker(): WorkerState {
  return workersState()[nell.id];
}

function gathered(): number {
  const { status } = worker();
  return status.kind === 'Gathering' ? status.itemsGathered : -1;
}

const tick = () => inTick(() => workerGatheringProcessTick(nell.id));

function tickUntil(done: () => boolean): number {
  let ticks = 0;
  while (!done()) {
    if (ticks >= 1000) throw new Error('condition never reached');
    tick();
    ticks += 1;
  }
  return ticks;
}

function ticksForOneUnit(): number {
  const start = gathered();
  return tickUntil(() => gathered() !== start);
}

const tripStarted = () =>
  vi.mocked(workerBeginReturnTrip).mock.calls.length > 0;

function seedNode(gathering = woods()): void {
  seedContent([nell, copper, gathering]);
  seedWorldNodes([{ name: nodeName, type: 'GatherNode' }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(workerAssignmentIsValid).mockReturnValue(true);
  vi.mocked(workerBeginReturnTrip).mockReturnValue(true);
  seedNode();
});

describe('workerGatherXpGateSatisfied', () => {
  it('holds within the node’s worker level range, inclusive', () => {
    const gathering = woods({ workerLevelRange: { min: 5, max: 10 } });

    expect(
      [4, 5, 10, 11].map((level) =>
        workerGatherXpGateSatisfied(gathering, level),
      ),
    ).toEqual([false, true, true, false]);
  });
});

describe('workerGatheringProcessTick', () => {
  it('builds up progress, then lands a unit with xp and a VFX, starting the next one fresh', () => {
    seedGatherer();

    tick();
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
    seedNode(woods({ gatherReductionPerUpgradeLevel: 2 }));

    seedGatherer();
    const base = ticksForOneUnit();
    seedGatherer(
      {},
      (state) => (state.gatherNodeLevels[nodeName] = { level: 2 }),
    );

    expect(ticksForOneUnit()).toBeLessThan(base);
  });

  it('earns no xp outside the node’s worker level range', () => {
    seedNode(woods({ workerLevelRange: { min: 5, max: 10 } }));
    seedGatherer();

    ticksForOneUnit();

    expect(worker().xp.current).toBe(0);
  });

  it('heads home with a full load, showing the last unit only if the trip starts', () => {
    const full = workerStatsForLevel(nell, 1).capacity;
    seedGatherer({ itemsGathered: full - 1 });

    tickUntil(tripStarted);

    expect(workerBeginReturnTrip).toHaveBeenCalledWith(
      nell.id,
      copper.id,
      full,
    );
    expect(gatherVfxEmit).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    vi.mocked(workerBeginReturnTrip).mockReturnValue(false);
    seedGatherer({ itemsGathered: full - 1 });
    tickUntil(tripStarted);
    expect(gatherVfxEmit).not.toHaveBeenCalled();
  });

  it('parks the worker at the Duchy once its assignment goes stale', () => {
    vi.mocked(workerAssignmentIsValid).mockReturnValue(false);
    seedGatherer();

    tick();

    expect(worker().status).toEqual({ kind: 'AtDuchy' });
    expect(worker().assignment).toBeNull();
  });
});
