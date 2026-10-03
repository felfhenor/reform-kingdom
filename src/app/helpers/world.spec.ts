import { describe, expect, it } from 'vitest';

import { isPartyAtNode, isPlayerAtKingdom } from '@helpers/world';
import type { CurrentLocation } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

function standAt(location: CurrentLocation): void {
  seedGamestate((state) => (state.world.currentLocation = location));
}

function seedMap() {
  return seedWorldNodes([
    { name: 'Duchy of Carrina', type: 'Kingdom', x: 1 },
    { name: 'Forest Ruins', type: 'ExploreNode', x: 2 },
  ]);
}

describe('isPartyAtNode / isPlayerAtKingdom', () => {
  it('only match the node the party is standing on', () => {
    const nodes = seedMap();

    standAt(locationOf(nodes['Duchy of Carrina']));
    expect(isPartyAtNode('Duchy of Carrina')).toBe(true);
    expect(isPartyAtNode('Forest Ruins')).toBe(false);
    expect(isPlayerAtKingdom()).toBe(true);

    standAt(locationOf(nodes['Forest Ruins']));
    expect(isPartyAtNode('Forest Ruins')).toBe(true);
    expect(isPlayerAtKingdom()).toBe(false);
  });

  it('match nothing between nodes', () => {
    const nodes = seedMap();

    standAt({ ...locationOf(nodes['Forest Ruins']), x: 50 });

    expect(isPartyAtNode('Forest Ruins')).toBe(false);
    expect(isPlayerAtKingdom()).toBe(false);
  });
});
