import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/worker/town-worker-travel');

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { worldTownsState } from '@helpers/state-game';
import {
  townWorkerGatherRate,
  townWorkerGatheringProcessTick,
} from '@helpers/town/worker/town-worker-gathering';
import {
  townWorkerAssignmentIsValid,
  townWorkerBeginReturnTrip,
} from '@helpers/town/worker/town-worker-travel';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import type {
  GameState,
  GatheringContent,
  GatheringId,
  ItemId,
  TownContent,
  TownId,
  TownWorkerState,
  TownWorkerStatusGathering,
  WorkerId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const darwin = ensureWorker({
  id: 'darwin' as WorkerId,
  name: 'Darwin',
  baseStats: { capacity: 2, gatherSpeed: 1, stamina: 20 },
});
const ore = ensureItem({ id: 'copper-ore' as ItemId, name: 'Copper Ore' });
const nodeName = 'Wergen Woods';

function town(gatherRateMultiplier = 1): TownContent {
  return ensureTown({
    id: 'larsia' as TownId,
    name: 'Larsia',
    gathering: { gatherRateMultiplier },
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

function seedGatherer(
  content: TownContent,
  status: Partial<TownWorkerStatusGathering> = {},
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate((state) => {
    state.world.towns[content.id] = buildTownNodeState({
      workers: {
        [darwin.id]: {
          ...defaultTownWorkerState(content, 1),
          status: {
            kind: 'Gathering',
            nodeName,
            itemId: ore.id,
            itemsGathered: 0,
            ticksIntoGather: 0,
            ...status,
          },
          assignment: { nodeName, itemId: ore.id },
        },
      },
    });
    edit(state);
  });
}

function worker(content: TownContent): TownWorkerState {
  return worldTownsState()[content.id].workers[darwin.id];
}

function gathered(content: TownContent): number {
  const { status } = worker(content);
  if (status.kind !== 'Gathering') throw new Error(`stopped ${status.kind}`);
  return status.itemsGathered;
}

function ticksForOneUnit(content: TownContent): number {
  const start = gathered(content);
  let ticks = 0;
  while (gathered(content) === start) {
    if (ticks >= 1000) throw new Error('never gathered');
    inTick(() => townWorkerGatheringProcessTick(content, darwin.id));
    ticks += 1;
  }
  return ticks;
}

function seedNode(gathering = woods()): void {
  seedContent([darwin, ore, gathering]);
  seedWorldNodes([{ name: nodeName, type: 'GatherNode' }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(true);
  seedNode();
});

describe('townWorkerGatherRate', () => {
  it('scales the worker’s base rate by the town’s multiplier', () => {
    const rate = (multiplier: number) =>
      townWorkerGatherRate(darwin, 1, woods(), ore.id, 0, multiplier);

    expect(rate(1)).toBeGreaterThan(0);
    expect(rate(3)).toBeCloseTo(rate(1) * 3);
    expect(
      townWorkerGatherRate(darwin, 1, woods(), 'iron' as ItemId, 0, 1),
    ).toBe(0);
  });
});

describe('townWorkerGatheringProcessTick', () => {
  it('builds up progress, then lands a unit and starts the next one fresh', () => {
    const larsia = town();
    seedGatherer(larsia);

    inTick(() => townWorkerGatheringProcessTick(larsia, darwin.id));
    expect(worker(larsia).status).toMatchObject({
      ticksIntoGather: 1,
      itemsGathered: 0,
    });

    ticksForOneUnit(larsia);

    expect(worker(larsia).status).toMatchObject({
      ticksIntoGather: 0,
      itemsGathered: 1,
    });
    expect(townWorkerBeginReturnTrip).not.toHaveBeenCalled();
  });

  it('gathers faster in a busier town and on an upgraded node', () => {
    const base = town();
    seedGatherer(base);
    const baseTicks = ticksForOneUnit(base);

    const busy = town(2);
    seedGatherer(busy);
    expect(ticksForOneUnit(busy)).toBeLessThan(baseTicks);

    seedNode(woods({ gatherReductionPerUpgradeLevel: 2 }));
    seedGatherer(base, {}, (state) => {
      state.gatherNodeLevels[nodeName] = { level: 2 };
    });
    expect(ticksForOneUnit(base)).toBeLessThan(baseTicks);
  });

  it('heads home with a full load', () => {
    const larsia = town();
    const full = workerStatsForLevel(darwin, 1).capacity;
    seedGatherer(larsia, { itemsGathered: full - 1 });

    for (
      let i = 0;
      vi.mocked(townWorkerBeginReturnTrip).mock.calls.length === 0;
      i++
    ) {
      if (i >= 1000) throw new Error('never headed home');
      inTick(() => townWorkerGatheringProcessTick(larsia, darwin.id));
    }

    expect(townWorkerBeginReturnTrip).toHaveBeenCalledWith(
      larsia.id,
      larsia,
      darwin.id,
      ore.id,
      full,
    );
  });

  it('parks the worker at town once its assignment goes stale', () => {
    const larsia = town();
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(false);
    seedGatherer(larsia);

    inTick(() => townWorkerGatheringProcessTick(larsia, darwin.id));

    expect(worker(larsia)).toMatchObject({
      status: { kind: 'AtTown' },
      assignment: null,
    });
  });
});
