import { describe, expect, it } from 'vitest';

import { ensureCollectibleGate } from '@helpers/content/ensure-collectiblegate';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import {
  isWorldNodeGateOpen,
  worldNodeGateProgress,
  worldNodeGateRequiredIds,
} from '@helpers/world-node/world-node-gate';
import type { CollectibleGateId, CollectibleId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const requiredIds = ['ruby', 'lotus', 'orb'] as CollectibleId[];

function seedGate() {
  seedContent([
    ensureCollectibleGate({
      id: 'gate' as CollectibleGateId,
      name: 'Memory Gateway',
      requiredCollectibleIds: requiredIds,
    }),
  ]);
  return seedWorldNodes([
    { name: 'Memory Gateway', type: 'CollectibleGate' },
    { name: 'Field Ruins', type: 'ExploreNode' },
  ]);
}

const grant = (ids: CollectibleId[]) =>
  seedGamestate((state) =>
    ids.forEach((id) => applyCollectibleGrant(state, id, 1)),
  );

describe('worldNodeGateRequiredIds', () => {
  it("returns the gate's required collectibles", () => {
    const nodes = seedGate();

    expect(worldNodeGateRequiredIds(nodes['Memory Gateway'])).toEqual(
      requiredIds,
    );
  });

  it('is empty for a node that is not a gate', () => {
    const nodes = seedGate();

    expect(worldNodeGateRequiredIds(nodes['Field Ruins'])).toEqual([]);
  });
});

describe('worldNodeGateProgress', () => {
  it('counts found collectibles against the requirement', () => {
    const nodes = seedGate();
    grant(['ruby', 'unrelated'] as CollectibleId[]);

    expect(worldNodeGateProgress(nodes['Memory Gateway'])).toEqual({
      obtained: 1,
      total: 3,
    });
  });
});

describe('isWorldNodeGateOpen', () => {
  it('is shut until every required collectible is found', () => {
    const nodes = seedGate();
    grant(requiredIds.slice(0, 2));

    expect(isWorldNodeGateOpen(nodes['Memory Gateway'])).toBe(false);
  });

  it('opens once every required collectible is found', () => {
    const nodes = seedGate();
    grant(requiredIds);

    expect(isWorldNodeGateOpen(nodes['Memory Gateway'])).toBe(true);
  });

  it('never blocks a node that is not a gate', () => {
    const nodes = seedGate();

    expect(isWorldNodeGateOpen(nodes['Field Ruins'])).toBe(true);
  });

  it('stays shut when a gate node has no content', () => {
    const nodes = seedWorldNodes([
      { name: 'Unknown Gate', type: 'CollectibleGate' },
    ]);

    expect(isWorldNodeGateOpen(nodes['Unknown Gate'])).toBe(false);
  });
});
