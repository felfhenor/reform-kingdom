import { describe, expect, it } from 'vitest';

import { ensureNodeOverride } from '@helpers/content/ensure-nodeoverride';
import { setAllMaps } from '@helpers/maps';
import {
  mapHopsBetween,
  repairUnwalkableCurrentLocation,
  tiledMapMoveCostMatrix,
  tiledMapPathMatrix,
  tiledMapWalkabilityMatrix,
  tileIsOnPath,
} from '@helpers/pathfinding/pathfinding';
import { seedContent } from '@/testing/content';
import { seedWorldNodes } from '@/testing/world';
import type {
  GameMap,
  TiledLayer,
  TiledMap,
  TiledObject,
  CollectibleId,
  NodeOverrideId,
} from '@interfaces';

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

function buildOpenMap(width: number, height: number): TiledMap {
  return {
    width,
    height,
    tilewidth: 64,
    tileheight: 64,
    tilesets: [],
    layers: [],
  };
}

describe('tiledMapWalkabilityMatrix', () => {
  it('marks tiles under a non-zero Dense Tiles gid as blocked', () => {
    const denseTilesLayer: TiledLayer = {
      id: 1,
      name: 'Dense Tiles',
      type: 'tilelayer',
      visible: true,
      width: 3,
      height: 3,
      data: [0, 0, 0, 0, 5, 0, 0, 0, 0],
    };

    const map: TiledMap = { ...buildOpenMap(3, 3), layers: [denseTilesLayer] };

    const matrix = tiledMapWalkabilityMatrix(map);

    expect(matrix).toEqual([
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ]);
  });

  it('marks every tile covered by a Dense Objects bounding box as blocked', () => {
    const denseObjectsLayer: TiledLayer = {
      id: 2,
      name: 'Dense Objects',
      type: 'objectgroup',
      visible: true,
      objects: [buildObject({ x: 64, y: 128, width: 128, height: 64 })],
    };

    const map: TiledMap = {
      ...buildOpenMap(3, 3),
      layers: [denseObjectsLayer],
    };

    const matrix = tiledMapWalkabilityMatrix(map);

    expect(matrix).toEqual([
      [0, 0, 0],
      [0, 1, 1],
      [0, 0, 0],
    ]);
  });

  it('leaves an unobstructed map fully walkable', () => {
    const matrix = tiledMapWalkabilityMatrix(buildOpenMap(2, 2));

    expect(matrix).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});

describe('tiledMapPathMatrix', () => {
  it('marks tiles under a non-zero Path Tiles gid as on-path', () => {
    const pathTilesLayer: TiledLayer = {
      id: 1,
      name: 'Path Tiles',
      type: 'tilelayer',
      visible: true,
      width: 3,
      height: 3,
      data: [0, 0, 0, 0, 5, 0, 0, 0, 0],
    };

    const map: TiledMap = { ...buildOpenMap(3, 3), layers: [pathTilesLayer] };

    expect(tiledMapPathMatrix(map)).toEqual([
      [false, false, false],
      [false, true, false],
      [false, false, false],
    ]);
  });

  it('marks every tile covered by a Path Objects bounding box as on-path', () => {
    const pathObjectsLayer: TiledLayer = {
      id: 2,
      name: 'Path Objects',
      type: 'objectgroup',
      visible: true,
      objects: [buildObject({ x: 64, y: 128, width: 128, height: 64 })],
    };

    const map: TiledMap = { ...buildOpenMap(3, 3), layers: [pathObjectsLayer] };

    expect(tiledMapPathMatrix(map)).toEqual([
      [false, false, false],
      [false, true, true],
      [false, false, false],
    ]);
  });

  it('leaves a map with no path layers entirely off-path', () => {
    expect(tiledMapPathMatrix(buildOpenMap(2, 2))).toEqual([
      [false, false],
      [false, false],
    ]);
  });

  it('marks the tile a rotated bend object actually renders into, not its unrotated footprint', () => {
    // Rotated -90deg around (128,128) lands on (1,1); a rotation-blind bounding box would wrongly give (2,1).
    const pathObjectsLayer: TiledLayer = {
      id: 2,
      name: 'Path Objects',
      type: 'objectgroup',
      visible: true,
      objects: [
        buildObject({ x: 128, y: 128, width: 64, height: 64, rotation: -90 }),
      ],
    };

    const map: TiledMap = { ...buildOpenMap(4, 4), layers: [pathObjectsLayer] };
    const matrix = tiledMapPathMatrix(map);

    expect(matrix[1][1]).toBe(true);
    expect(matrix[1][2]).toBe(false);
  });
});

describe('tiledMapMoveCostMatrix', () => {
  it('costs blocked tiles as infinite, path tiles cheap, and everything else more expensive', () => {
    const denseTilesLayer: TiledLayer = {
      id: 1,
      name: 'Dense Tiles',
      type: 'tilelayer',
      visible: true,
      width: 3,
      height: 1,
      data: [0, 1, 0],
    };
    const pathTilesLayer: TiledLayer = {
      id: 2,
      name: 'Path Tiles',
      type: 'tilelayer',
      visible: true,
      width: 3,
      height: 1,
      data: [5, 0, 0],
    };

    const map: TiledMap = {
      ...buildOpenMap(3, 1),
      layers: [denseTilesLayer, pathTilesLayer],
    };

    const matrix = tiledMapMoveCostMatrix(map);

    expect(matrix[0][0]).toBe(1);
    expect(matrix[0][1]).toBe(Number.POSITIVE_INFINITY);
    expect(matrix[0][2]).toBeGreaterThan(matrix[0][0]);
    expect(Number.isFinite(matrix[0][2])).toBe(true);
  });
});

function setMapWithKingdom(denseTiles: { x: number; y: number }[] = []) {
  seedWorldNodes(
    [
      {
        name: 'Duchy of Carrina',
        type: 'Kingdom',
        mapName: 'Carrina',
        x: 2,
        y: 2,
      },
    ],
    [],
    { Carrina: { width: 3, height: 3, denseTiles } },
  );
}

describe('repairUnwalkableCurrentLocation', () => {
  it('leaves a walkable location untouched', () => {
    setMapWithKingdom();
    const location = { mapName: 'Carrina', x: 1, y: 1 };

    expect(repairUnwalkableCurrentLocation(location)).toEqual(location);
  });

  it('relocates to the kingdom when standing on a blocked tile or an unknown map', () => {
    setMapWithKingdom([{ x: 1, y: 1 }]);
    const kingdom = { mapName: 'Carrina', x: 2, y: 2 };

    expect(
      repairUnwalkableCurrentLocation({ mapName: 'Carrina', x: 1, y: 1 }),
    ).toEqual(kingdom);
    expect(
      repairUnwalkableCurrentLocation({ mapName: 'Nowhere', x: 0, y: 0 }),
    ).toEqual(kingdom);
  });

  it('leaves the location untouched when blocked and no kingdom node exists', () => {
    setAllMaps(new Map<string, GameMap>());
    const location = { mapName: 'Nowhere', x: 0, y: 0 };

    expect(repairUnwalkableCurrentLocation(location)).toEqual(location);
  });
});

describe('tileIsOnPath', () => {
  it('is true only for a tile covered by the Path Tiles layer of a loaded map', () => {
    const pathTilesLayer: TiledLayer = {
      id: 1,
      name: 'Path Tiles',
      type: 'tilelayer',
      visible: true,
      width: 3,
      height: 3,
      data: [0, 0, 0, 0, 5, 0, 0, 0, 0],
    };
    setAllMaps(
      new Map<string, GameMap>([
        [
          'Carrina',
          {
            name: 'Carrina',
            data: { ...buildOpenMap(3, 3), layers: [pathTilesLayer] },
          },
        ],
      ]),
    );

    expect(tileIsOnPath('Carrina', 1, 1)).toBe(true);
    expect(tileIsOnPath('Carrina', 0, 0)).toBe(false);
    expect(tileIsOnPath('Unknown', 0, 0)).toBe(false);
  });
});

describe('mapHopsBetween', () => {
  const teleport = (
    from: string,
    fromMap: string,
    to: string,
    toMap: string,
  ) => [
    {
      name: from,
      type: 'TeleportNode' as const,
      mapName: fromMap,
      properties: [{ name: 'toTag', type: 'string', value: to }],
    },
    {
      name: to,
      type: 'TeleportNode' as const,
      mapName: toMap,
      properties: [{ name: 'tag', type: 'string', value: to }],
    },
  ];

  it('is 0 for the same map and 1 for a directly linked one', () => {
    seedWorldNodes(
      teleport('To Mire', 'Carrina', 'To Carrina', 'CraggledMire'),
    );

    expect(mapHopsBetween('Carrina', 'Carrina')).toBe(0);
    expect(mapHopsBetween('Carrina', 'CraggledMire')).toBe(1);
  });

  it('terminates with no connection between the maps', () => {
    seedWorldNodes([{ name: 'Field', type: 'ExploreNode' }]);

    expect(mapHopsBetween('Carrina', 'Nowhere')).toBeGreaterThan(0);
  });

  it('routes around a locked teleport pair instead of counting it as a hop', () => {
    seedContent(
      ['Direct Out', 'Direct In'].map((name) =>
        ensureNodeOverride({
          id: name as NodeOverrideId,
          name,
          invisibleUntilCollectibleIdsFound: ['key' as CollectibleId],
        }),
      ),
    );
    seedWorldNodes([
      ...teleport('Direct Out', 'Carrina', 'Direct In', 'CraggledMire'),
      ...teleport('Detour Out', 'Carrina', 'Waypoint In', 'Waypoint'),
      ...teleport('Waypoint Out', 'Waypoint', 'Detour In', 'CraggledMire'),
    ]);

    expect(mapHopsBetween('Carrina', 'CraggledMire')).toBe(2);
  });
});
