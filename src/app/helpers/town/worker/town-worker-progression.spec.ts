import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
}));

import {
  defaultTownWorkerState,
  townWorkerStatsForLevel,
} from '@helpers/town/worker/town-worker-progression';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type { TownContent, WorkerContent, WorldNodeEntry } from '@interfaces';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townWorkerStatsForLevel', () => {
  it('applies base + perLevel * (level - 1)', () => {
    const worker = {
      baseStats: { capacity: 10, gatherSpeed: 0.5, stamina: 100 },
      statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 1 },
    } as WorkerContent;

    expect(townWorkerStatsForLevel(worker, 3)).toEqual({
      capacity: 11,
      gatherSpeed: 0.7,
      stamina: 102,
    });
  });
});

describe('defaultTownWorkerState', () => {
  const town = { name: 'Larsia' } as TownContent;

  it("resolves the town's node location", () => {
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'LarsianDesert',
      x: 5,
      y: 9,
    } as WorldNodeEntry);

    expect(defaultTownWorkerState(town, 1)).toEqual({
      level: 1,
      location: { mapName: 'LarsianDesert', x: 5, y: 9 },
      status: { kind: 'AtTown' },
      assignment: null,
    });
  });

  it('falls back to an empty location when the town has no map node', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(defaultTownWorkerState(town, 1).location).toEqual({
      mapName: '',
      x: 0,
      y: 0,
    });
  });

  it('seeds the given level', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(defaultTownWorkerState(town, 4).level).toBe(4);
  });
});
