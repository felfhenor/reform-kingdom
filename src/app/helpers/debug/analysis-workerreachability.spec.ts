import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/debug/analysis-utils', () => ({
  buildNodeNameToMap: vi.fn(() => new Map()),
}));

vi.mock('@helpers/hero/travel-cost', () => ({
  travelPathTotalTicks: vi.fn(),
}));

vi.mock('@helpers/pathfinding/pathfinding', () => ({
  travelPathFrom: vi.fn((kingdom: unknown, nodeName: string) => ({ nodeName })),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  kingdomNodeGet: vi.fn(() => ({ nodeName: 'Duchy' })),
}));

import { getEntriesByType } from '@helpers/content';
import { runWorkerReachabilityAnalysis } from '@helpers/debug/analysis-workerreachability';
import { travelPathTotalTicks } from '@helpers/hero/travel-cost';
import type { GatheringContent, LevelRange, WorkerContent, WorkerId } from '@interfaces';

function buildWorker(
  id: string,
  baseStamina: number,
  staminaPerLevel: number,
): WorkerContent {
  return {
    id: id as WorkerId,
    name: id,
    __type: 'worker',
    description: 'test',
    sprite: '0000',
    frames: 4,
    baseStats: { capacity: 1, gatherSpeed: 1, stamina: baseStamina },
    statsPerLevel: { capacity: 0, gatherSpeed: 0, stamina: staminaPerLevel },
  };
}

function buildGathering(
  name: string,
  levelRange: LevelRange,
): GatheringContent {
  return {
    id: name as never,
    name,
    __type: 'gathering',
    description: 'test',
    hidden: false,
    levelRange: { min: 1, max: 1 },
    xpGainedIfInLevelRange: 0,
    gatherTime: 1,
    gatherResults: [],
    workerLevelRange: levelRange,
  };
}

// Node's one-way stamina cost is looked up by name via the mocked travelPathFrom/travelPathTotalTicks pairing.
function mockStaminaCosts(costs: Record<string, number>): void {
  vi.mocked(travelPathTotalTicks).mockImplementation(
    (path: unknown) => costs[(path as { nodeName: string }).nodeName],
  );
}

describe('runWorkerReachabilityAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('names the node that actually covers the stuck level, not one that covers the level after it', () => {
    // Flat stamina (10, never grows) - reachable nodes never change as the worker levels.
    const worker = buildWorker('flat', 10, 0);
    vi.mocked(getEntriesByType).mockImplementation((type: string) =>
      type === 'worker' ? [worker] : [
        buildGathering('Near', { min: 1, max: 6 }),
        buildGathering('TooFar', { min: 7, max: 7 }),
        buildGathering('AlsoReachable', { min: 8, max: 10 }),
      ],
    );
    mockStaminaCosts({ Near: 10, TooFar: 999, AlsoReachable: 10 });

    const result = runWorkerReachabilityAnalysis();

    const gapsTable = result.tables?.[1];
    expect(gapsTable?.rows).toEqual([
      expect.objectContaining({
        Worker: 'flat',
        'Stuck At': 7,
        'Blocking Node': 'TooFar',
      }),
    ]);
  });

  it('fails a node unreachable by every worker, without warning on individually-late pairs', () => {
    const cheapWorker = buildWorker('cheap', 100, 0);
    const gathering = buildGathering('Distant Mine', { min: 1, max: 99 });
    vi.mocked(getEntriesByType).mockImplementation((type: string) =>
      type === 'worker' ? [cheapWorker] : [gathering],
    );
    mockStaminaCosts({ 'Distant Mine': 999 });

    const result = runWorkerReachabilityAnalysis();

    const reachabilityCheck = result.checks.find((c) => c.id === 'unreachable');
    expect(reachabilityCheck).toMatchObject({
      status: 'fail',
      message: expect.stringContaining('Distant Mine'),
    });
  });

  it('passes both checks when every worker can level all the way to the content-wide cap', () => {
    const worker = buildWorker('reliable', 100, 0);
    const gathering = buildGathering('Nearby', { min: 1, max: 98 });
    vi.mocked(getEntriesByType).mockImplementation((type: string) =>
      type === 'worker' ? [worker] : [gathering],
    );
    mockStaminaCosts({ Nearby: 5 });

    const result = runWorkerReachabilityAnalysis();

    expect(result.checks.map((c) => c.status)).toEqual(['pass', 'pass']);
    expect(result.tables?.[1].rows).toEqual([]);
  });
});
