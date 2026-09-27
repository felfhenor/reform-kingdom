import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
}));

import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type { TownContent, WorldNodeEntry } from '@interfaces';

beforeEach(() => {
  vi.clearAllMocks();
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
