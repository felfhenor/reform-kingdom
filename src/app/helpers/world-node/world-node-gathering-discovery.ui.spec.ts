import { describe, expect, it } from 'vitest';

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import {
  gatherableDiscoveredMaterialIds,
  gatherNodeFarmOptions,
  gatherNodeFarmOptionsFor,
  gatherNodeMaterialIds,
} from '@helpers/world-node/world-node-gathering-discovery.ui';
import type { GatheringId, ItemId, MaterialId } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const result = (itemId: string) =>
  ensureGatherResult({
    chance: 50,
    items: [{ itemId: itemId as ItemId, quantity: 1 }],
  });

// Woods and Quarry both yield stone; only Woods yields wood. Ruins is undiscovered.
function seedNodes(discoveredMaterials: string[]) {
  seedContent([
    ensureGathering({
      id: 'g-woods' as GatheringId,
      name: 'Woods',
      gatherResults: [result('wood'), result('stone')],
    }),
    ensureGathering({
      id: 'g-quarry' as GatheringId,
      name: 'Quarry',
      gatherResults: [result('stone')],
    }),
    ensureGathering({
      id: 'g-ruins' as GatheringId,
      name: 'Ruins',
      gatherResults: [result('relic')],
    }),
  ]);
  seedGamestate((state) => {
    ['Woods', 'Quarry', 'Ruins'].forEach(
      (name) => (state.gatherNodeLevels[name] = { level: 0 }),
    );
    ['Woods', 'Quarry'].forEach(
      (name) => (state.discoveredGatherNodes[name] = { foundAt: 1 }),
    );
    discoveredMaterials.forEach(
      (id) => (state.discoveredMaterials[id as MaterialId] = { foundAt: 1 }),
    );
  });
  seedWorldNodes([
    { name: 'Woods', type: 'GatherNode' },
    { name: 'Quarry', type: 'GatherNode' },
    { name: 'Ruins', type: 'GatherNode' },
  ]);
}

describe('gatherableDiscoveredMaterialIds', () => {
  it('lists each discovered material from discovered nodes once', () => {
    seedNodes(['wood', 'stone', 'relic']);

    expect(sortBy(gatherableDiscoveredMaterialIds())).toEqual([
      'stone',
      'wood',
    ]);
  });

  it('hides materials the player hasn’t found yet', () => {
    seedNodes(['stone']);

    expect(gatherableDiscoveredMaterialIds()).toEqual(['stone']);
  });
});

describe('gatherNodeFarmOptionsFor', () => {
  it('lists every discovered node yielding the material, sorted by name', () => {
    seedNodes(['wood', 'stone']);

    const names = (id: string) =>
      gatherNodeFarmOptionsFor(id as MaterialId).map((o) => o.nodeName);
    expect(names('stone')).toEqual(['Quarry', 'Woods']);
    expect(names('wood')).toEqual(['Woods']);
    expect(names('relic')).toEqual([]);
  });
});

describe('gatherNodeFarmOptions', () => {
  it('lists discovered nodes with a discovered material, sorted by name', () => {
    seedNodes(['wood']);
    expect(gatherNodeFarmOptions().map((o) => o.nodeName)).toEqual(['Woods']);

    seedNodes(['wood', 'stone', 'relic']);
    expect(gatherNodeFarmOptions().map((o) => o.nodeName)).toEqual([
      'Quarry',
      'Woods',
    ]);
  });
});

describe('gatherNodeMaterialIds', () => {
  it('lists only the discovered materials a node yields', () => {
    seedNodes(['stone']);

    expect(gatherNodeMaterialIds('Woods')).toEqual(['stone']);
    expect(gatherNodeMaterialIds('Nowhere')).toEqual([]);
  });
});
