import { describe, expect, it } from 'vitest';

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import type { GatheringId, GatherResult, ItemId } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const result = (itemId: string, overrides: Partial<GatherResult> = {}) =>
  ensureGatherResult({
    chance: 50,
    items: [{ itemId: itemId as ItemId, quantity: 1 }],
    ...overrides,
  });

function seedWoods(gatherResults: GatherResult[], nodeLevel = 0) {
  seedContent([
    ensureGathering({
      id: 'gather-1' as GatheringId,
      name: 'Wergen Woods',
      gatherResults,
    }),
  ]);
  seedGamestate(
    (state) => (state.gatherNodeLevels['Wergen Woods'] = { level: nodeLevel }),
  );
  return seedWorldNodes([
    { name: 'Wergen Woods', type: 'GatherNode' },
    { name: 'Signpost', type: 'ExploreNode' },
  ]);
}

const materialsAt = (nodes: ReturnType<typeof seedWoods>, name: string) =>
  sortBy(worldNodeGatherMaterialIds(nodes[name]));

describe('worldNodeGatherMaterialIds', () => {
  it('lists each item the node yields once', () => {
    const nodes = seedWoods([
      result('wood'),
      result('sap'),
      result('wood', { items: [{ itemId: 'wood' as ItemId, quantity: 2 }] }),
    ]);

    expect(materialsAt(nodes, 'Wergen Woods')).toEqual(['sap', 'wood']);
  });

  it('includes a level-gated result only once the node reaches that level', () => {
    const results = [
      result('wood'),
      result('azurite', { levelRequirement: 2 }),
    ];

    expect(materialsAt(seedWoods(results), 'Wergen Woods')).toEqual(['wood']);
    expect(materialsAt(seedWoods(results, 2), 'Wergen Woods')).toEqual([
      'azurite',
      'wood',
    ]);
  });

  it('is empty for a node that isn’t a gather node', () => {
    const nodes = seedWoods([result('wood')]);

    expect(materialsAt(nodes, 'Signpost')).toEqual([]);
  });
});
