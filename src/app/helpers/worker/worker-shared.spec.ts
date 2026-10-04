import { describe, expect, it } from 'vitest';

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import {
  applyWorkerGatherProgress,
  applyWorkerGatherUnit,
  applyWorkerTravelAdvance,
  workerGatherNodeHasItem,
  workerGatherRate,
  workerGatherTickOutcome,
  workerGatheringStatusStart,
} from '@helpers/worker/worker-shared';
import type {
  AnyWorkerState,
  GatheringContent,
  GatheringId,
  ItemId,
  TravelStep,
  WorkerContent,
  WorkerId,
  WorkerStatusGathering,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const WORKER_ID = 'weaver-nell' as WorkerId;
const COPPER_ID = 'copper-ore' as ItemId;
const MALACHITE_ID = 'malachite' as ItemId;
// Only gatherable once the node is developed to level 2.
const GOLD_VEIN_ID = 'gold-vein' as ItemId;

const workerContent: WorkerContent = ensureWorker({
  id: WORKER_ID,
  name: 'Weaver Nell',
  description: 'test',
  sprite: '0000',
  frames: 4,
  baseStats: { capacity: 6, gatherSpeed: 2, stamina: 30 },
  statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 2 },
  canUseTeleports: true,
});

function buildGathering(
  overrides: Partial<GatheringContent> = {},
): GatheringContent {
  return ensureGathering({
    id: 'Wergen Woods' as GatheringId,
    name: 'Wergen Woods',
    description: 'test',
    levelRange: { min: 1, max: 10 },
    xpGainedIfInLevelRange: 5,
    gatherTime: 10,
    gatherResults: [
      ensureGatherResult({
        chance: 80,
        items: [{ itemId: COPPER_ID, quantity: 1 }],
      }),
      ensureGatherResult({
        chance: 20,
        items: [{ itemId: MALACHITE_ID, quantity: 1 }],
      }),
      ensureGatherResult({
        chance: 100,
        items: [{ itemId: GOLD_VEIN_ID, quantity: 1 }],
        levelRequirement: 2,
      }),
    ],
    hidden: false,
    workerLevelRange: { min: 1, max: 999 },
    ...overrides,
  });
}

function gatheringStatus(
  overrides: Partial<WorkerStatusGathering> = {},
): WorkerStatusGathering {
  return {
    kind: 'Gathering',
    nodeName: 'Wergen Woods',
    itemId: COPPER_ID,
    itemsGathered: 0,
    ticksIntoGather: 0,
    ...overrides,
  };
}

function buildWorkerState(status: AnyWorkerState['status']): AnyWorkerState {
  return { location: { mapName: 'A', x: 0, y: 0 }, status };
}

describe('workerGatherRate', () => {
  const speedAt = (level: number) =>
    workerStatsForLevel(workerContent, level).gatherSpeed;

  it('scales the worker’s gather speed by the item’s share of the table at the node’s level', () => {
    const gathering = buildGathering();

    expect(workerGatherRate(workerContent, 1, gathering, COPPER_ID, 0)).toBe(
      speedAt(1) * (80 / 100),
    );
    expect(workerGatherRate(workerContent, 1, gathering, MALACHITE_ID, 0)).toBe(
      speedAt(1) * (20 / 100),
    );
    expect(workerGatherRate(workerContent, 1, gathering, COPPER_ID, 2)).toBe(
      speedAt(1) * (80 / 200),
    );
    expect(
      workerGatherRate(workerContent, 11, gathering, COPPER_ID, 0),
    ).toBeCloseTo(speedAt(11) * (80 / 100));
  });

  it('is 0 for an item the node can’t yield at its level', () => {
    const gathering = buildGathering();

    expect(
      workerGatherRate(workerContent, 1, gathering, 'unknown' as ItemId, 0),
    ).toBe(0);
    expect(workerGatherRate(workerContent, 1, gathering, GOLD_VEIN_ID, 0)).toBe(
      0,
    );
  });
});

describe('workerGatherNodeHasItem', () => {
  function seedWoods(nodeLevel = 0): void {
    seedContent([buildGathering()]);
    seedWorldNodes([
      { name: 'Wergen Woods', type: 'GatherNode' },
      { name: 'Signpost', type: 'ExploreNode' },
    ]);
    seedGamestate(
      (state) =>
        (state.gatherNodeLevels['Wergen Woods'] = { level: nodeLevel }),
    );
  }

  it('checks what the node yields at its current level', () => {
    seedWoods();
    expect(workerGatherNodeHasItem('Wergen Woods', MALACHITE_ID)).toBe(true);
    expect(workerGatherNodeHasItem('Wergen Woods', GOLD_VEIN_ID)).toBe(false);
    expect(workerGatherNodeHasItem('Wergen Woods', 'x' as ItemId)).toBe(false);

    seedWoods(2);
    expect(workerGatherNodeHasItem('Wergen Woods', GOLD_VEIN_ID)).toBe(true);
  });

  it('is false for a node that isn’t a gather node, or doesn’t exist', () => {
    seedWoods();

    expect(workerGatherNodeHasItem('Signpost', COPPER_ID)).toBe(false);
    expect(workerGatherNodeHasItem('Nowhere', COPPER_ID)).toBe(false);
  });
});

describe('workerGatherTickOutcome', () => {
  it('advances progress while under the per-unit tick count', () => {
    // gatherTime 10 at rate 2 = 5 ticks per unit.
    expect(
      workerGatherTickOutcome(gatheringStatus({ ticksIntoGather: 3 }), 2, 10),
    ).toEqual({ kind: 'Progress', ticksIntoGather: 4 });
  });

  it('keeps gathering through a fractional tick count until it is passed', () => {
    // gatherTime 25 at rate 4 = 6.25 ticks per unit: tick 6 is still short, tick 7 lands.
    expect(
      workerGatherTickOutcome(gatheringStatus({ ticksIntoGather: 5 }), 4, 25),
    ).toEqual({ kind: 'Progress', ticksIntoGather: 6 });
    expect(
      workerGatherTickOutcome(gatheringStatus({ ticksIntoGather: 6 }), 4, 25),
    ).toEqual({ kind: 'UnitGathered', itemsGathered: 1 });
  });

  it('gathers a unit once the tick count is reached', () => {
    expect(
      workerGatherTickOutcome(
        gatheringStatus({ ticksIntoGather: 4, itemsGathered: 2 }),
        2,
        10,
      ),
    ).toEqual({ kind: 'UnitGathered', itemsGathered: 3 });
  });
});

describe('applyWorkerGatherProgress / applyWorkerGatherUnit', () => {
  it('writes progress and resets it when a unit lands', () => {
    const worker = buildWorkerState(gatheringStatus());

    applyWorkerGatherProgress(worker, 3);
    expect(worker.status).toMatchObject({ ticksIntoGather: 3 });

    applyWorkerGatherUnit(worker, 1);
    expect(worker.status).toMatchObject({
      itemsGathered: 1,
      ticksIntoGather: 0,
    });
  });

  it('ignores a worker that is no longer gathering', () => {
    const worker = buildWorkerState({ kind: 'AtDuchy' });

    applyWorkerGatherProgress(worker, 3);
    applyWorkerGatherUnit(worker, 1);

    expect(worker.status).toEqual({ kind: 'AtDuchy' });
  });
});

describe('applyWorkerTravelAdvance', () => {
  const path: TravelStep[] = [{ kind: 'Move', mapName: 'A', x: 1, y: 1 }];
  const location = { mapName: 'A', x: 1, y: 1 };

  it('moves the worker and stores the remaining path mid-trip', () => {
    const worker = buildWorkerState({
      kind: 'TravelingTo',
      nodeName: 'Wergen Woods',
      itemId: COPPER_ID,
      path: [],
      ticksIntoStep: 0,
    });

    applyWorkerTravelAdvance(worker, {
      arrived: false,
      location,
      path,
      ticksIntoStep: 2,
    });

    expect(worker.location).toEqual(location);
    expect(worker.status).toMatchObject({ path, ticksIntoStep: 2 });
  });

  it('only moves a worker that is not traveling', () => {
    const worker = buildWorkerState(gatheringStatus({ ticksIntoGather: 2 }));

    applyWorkerTravelAdvance(worker, {
      arrived: false,
      location,
      path,
      ticksIntoStep: 4,
    });

    expect(worker.location).toEqual(location);
    expect(worker.status).toEqual(gatheringStatus({ ticksIntoGather: 2 }));
  });

  it('only moves the worker on arrival', () => {
    const worker = buildWorkerState({
      kind: 'TravelingBack',
      path: [],
      ticksIntoStep: 5,
      carriedQuantity: 0,
    });

    applyWorkerTravelAdvance(worker, { arrived: true, location });

    expect(worker.location).toEqual(location);
    expect(worker.status).toMatchObject({ path: [], ticksIntoStep: 5 });
  });
});

describe('workerGatheringStatusStart', () => {
  it('starts a fresh gather at the node', () => {
    expect(workerGatheringStatusStart('Wergen Woods', COPPER_ID)).toEqual(
      gatheringStatus(),
    );
  });
});
