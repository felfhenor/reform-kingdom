import type { GameMap, TiledLayer, TiledMap, TiledObject } from '@interfaces';
import { describe, expect, it } from 'vitest';

import { worldNodeMapsBuild } from '@helpers/world-nodes';

function buildObject(overrides: Partial<TiledObject>): TiledObject {
  return {
    id: 1,
    name: 'Unnamed',
    type: '',
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    visible: true,
    ...overrides,
  };
}

function buildMap(objects: {
  exploreNodes?: TiledObject[];
  otherNodes?: TiledObject[];
}): TiledMap {
  const layers: TiledLayer[] = [
    {
      id: 1,
      name: 'Explore Nodes',
      type: 'objectgroup',
      visible: true,
      objects: objects.exploreNodes ?? [],
    },
    {
      id: 2,
      name: 'Other Nodes',
      type: 'objectgroup',
      visible: true,
      objects: objects.otherNodes ?? [],
    },
  ];

  return {
    width: 50,
    height: 50,
    tilewidth: 64,
    tileheight: 64,
    tilesets: [],
    layers,
  };
}

describe('worldNodeMapsBuild', () => {
  it('converts pixel object coordinates to tile coordinates', () => {
    const kingdom = buildObject({
      name: 'Duchy of Carrina',
      type: 'Kingdom',
      x: 1536,
      y: 1600,
    });

    const maps = new Map<string, GameMap>([
      ['Carrina', { name: 'Carrina', data: buildMap({ otherNodes: [kingdom] }) }],
    ]);

    const { byPosition, byName } = worldNodeMapsBuild(maps);

    expect(byPosition['Carrina'][24][24]).toEqual({
      mapName: 'Carrina',
      x: 24,
      y: 24,
      nodeName: 'Duchy of Carrina',
      nodeData: kingdom,
    });
    expect(byName['Duchy of Carrina']).toEqual({
      mapName: 'Carrina',
      x: 24,
      y: 24,
      nodeName: 'Duchy of Carrina',
      nodeData: kingdom,
    });
  });

  it('reads objects from both node layers', () => {
    const explore = buildObject({
      id: 2,
      name: 'Forest Ruins',
      type: 'ExploreNode',
      x: 1152,
      y: 1536,
    });
    const teleport = buildObject({
      id: 3,
      name: 'To Craggled Mire',
      type: 'TeleportNode',
      x: 64,
      y: 1856,
    });

    const maps = new Map<string, GameMap>([
      [
        'Carrina',
        { name: 'Carrina', data: buildMap({
          exploreNodes: [explore],
          otherNodes: [teleport],
        }) },
      ],
    ]);

    const { byName } = worldNodeMapsBuild(maps);

    expect(byName['Forest Ruins'].nodeData.type).toBe('ExploreNode');
    expect(byName['To Craggled Mire'].nodeData.type).toBe('TeleportNode');
  });

  it('returns empty maps when there are no node layers', () => {
    const maps = new Map<string, GameMap>([
      ['Empty', { name: 'Empty', data: buildMap({}) }],
    ]);

    const { byPosition, byName } = worldNodeMapsBuild(maps);

    expect(byPosition['Empty']).toBeUndefined();
    expect(byName).toEqual({});
  });
});
