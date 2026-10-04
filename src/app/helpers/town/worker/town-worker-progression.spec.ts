import { describe, expect, it } from 'vitest';

import { ensureTown } from '@helpers/content/ensure-town';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import type { TownId } from '@interfaces';
import { locationOf, seedWorldNodes } from '@/testing/world';

const town = ensureTown({ id: 'larsia' as TownId, name: 'Larsia' });

describe('defaultTownWorkerState', () => {
  it('starts idle at the town’s own node, at the given level', () => {
    const nodes = seedWorldNodes([
      { name: 'Elsewhere', type: 'ExploreNode' },
      { name: town.name, type: 'NonPlayerKingdom' },
    ]);

    expect(defaultTownWorkerState(town, 4)).toEqual({
      level: 4,
      location: locationOf(nodes[town.name]),
      status: { kind: 'AtTown' },
      assignment: null,
    });
  });

  it('falls back to an empty location when the town has no map node', () => {
    expect(defaultTownWorkerState(town, 1).location).toEqual({
      mapName: '',
      x: 0,
      y: 0,
    });
  });
});
