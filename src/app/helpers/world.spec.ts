import { describe, expect, it } from 'vitest';

import {
  discoveredMapsState,
  worldCurrentLocationState,
} from '@helpers/state-game';
import {
  currentLocationSet,
  isPartyAtNode,
  isPlayerAtKingdom,
} from '@helpers/world';
import type { CurrentLocation } from '@interfaces';
import { inTick, seedGamestate } from '@/testing/gamestate';
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

describe('currentLocationSet', () => {
  it('moves the party and records the map as visited', () => {
    seedGamestate();
    const location = { mapName: 'Eastmarch', x: 3, y: 4 };

    inTick(() => currentLocationSet(location));

    expect(worldCurrentLocationState()).toEqual(location);
    expect(Object.keys(discoveredMapsState())).toEqual(['Eastmarch']);
  });
});
