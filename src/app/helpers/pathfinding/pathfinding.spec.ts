import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/maps', () => ({
  allMaps: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  isWorldNodeCollectibleGateMet: vi.fn(() => true),
  worldNodesOfType: vi.fn(),
}));

import { allMaps } from '@helpers/maps';
import {
  mapHopsBetween,
  repairUnwalkableCurrentLocation,
  tiledMapMoveCostMatrix,
  tiledMapPathMatrix,
  tiledMapWalkabilityMatrix,
  tileIsOnPath,
} from '@helpers/pathfinding/pathfinding';
import {
  isWorldNodeCollectibleGateMet,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  GameMap,
  TiledLayer,
  TiledMap,
  TiledObject,
  WorldNodeEntry,
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

function buildEntry(overrides: Partial<WorldNodeEntry>): WorldNodeEntry {
  return {
    mapName: 'Carrina',
    x: 0,
    y: 0,
    nodeName: 'Unnamed',
    nodeData: buildObject({}),
    ...overrides,
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

describe('repairUnwalkableCurrentLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('leaves a walkable location untouched', () => {
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(3, 3) }],
      ]),
    );

    const location = { mapName: 'Carrina', x: 1, y: 1 };

    expect(repairUnwalkableCurrentLocation(location)).toEqual(location);
  });

  it('relocates to the kingdom when standing on a blocked tile', () => {
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

    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([['Carrina', { name: 'Carrina', data: map }]]),
    );
    vi.mocked(worldNodesOfType).mockReturnValue([
      buildEntry({
        mapName: 'Carrina',
        x: 26,
        y: 24,
        nodeName: 'Duchy of Carrina',
      }),
    ]);

    expect(
      repairUnwalkableCurrentLocation({ mapName: 'Carrina', x: 1, y: 1 }),
    ).toEqual({ mapName: 'Carrina', x: 26, y: 24 });
  });

  it('relocates to the kingdom when the map is unknown', () => {
    vi.mocked(allMaps).mockReturnValue(new Map<string, GameMap>());
    vi.mocked(worldNodesOfType).mockReturnValue([
      buildEntry({
        mapName: 'Carrina',
        x: 26,
        y: 24,
        nodeName: 'Duchy of Carrina',
      }),
    ]);

    expect(
      repairUnwalkableCurrentLocation({ mapName: 'Nowhere', x: 0, y: 0 }),
    ).toEqual({ mapName: 'Carrina', x: 26, y: 24 });
  });

  it('leaves the location untouched when blocked and no kingdom node exists', () => {
    vi.mocked(allMaps).mockReturnValue(new Map<string, GameMap>());
    vi.mocked(worldNodesOfType).mockReturnValue([]);

    const location = { mapName: 'Nowhere', x: 0, y: 0 };

    expect(repairUnwalkableCurrentLocation(location)).toEqual(location);
  });
});

describe('tileIsOnPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true for a tile covered by the Path Tiles layer', () => {
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
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([['Carrina', { name: 'Carrina', data: map }]]),
    );

    expect(tileIsOnPath('Carrina', 1, 1)).toBe(true);
    expect(tileIsOnPath('Carrina', 0, 0)).toBe(false);
  });

  it('is false for a map that has not been loaded', () => {
    vi.mocked(allMaps).mockReturnValue(new Map<string, GameMap>());

    expect(tileIsOnPath('Unknown', 0, 0)).toBe(false);
  });
});

describe('mapHopsBetween', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 for the same map', () => {
    expect(mapHopsBetween('Carrina', 'Carrina')).toBe(0);
  });

  it('returns 1 for a directly teleport-connected map', () => {
    const teleportOut = buildEntry({
      mapName: 'Carrina',
      nodeName: 'To Craggled Mire',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'tag-a' }],
      }),
    });
    const teleportIn = buildEntry({
      mapName: 'CraggledMire',
      nodeName: 'To Carrina',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'tag-a' }],
      }),
    });

    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'TeleportNode' ? [teleportOut, teleportIn] : [],
    );

    expect(mapHopsBetween('Carrina', 'CraggledMire')).toBe(1);
  });

  it('terminates with no connection between the maps', () => {
    vi.mocked(worldNodesOfType).mockReturnValue([]);

    expect(mapHopsBetween('Carrina', 'Nowhere')).toBeGreaterThan(0);
  });

  it('routes around a locked teleport pair instead of counting it as a hop', () => {
    // A direct (but locked) pair plus a longer unlocked detour through a third map -
    // if the lock is respected, the detour's 2 hops win over the direct pair's 1.
    const directOut = buildEntry({
      mapName: 'Carrina',
      nodeName: 'Direct Out',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'direct-in' }],
      }),
    });
    const directIn = buildEntry({
      mapName: 'CraggledMire',
      nodeName: 'Direct In',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'direct-in' }],
      }),
    });
    const detourOut = buildEntry({
      mapName: 'Carrina',
      nodeName: 'Detour Out',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'waypoint-in' }],
      }),
    });
    const waypointIn = buildEntry({
      mapName: 'Waypoint',
      nodeName: 'Waypoint In',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'waypoint-in' }],
      }),
    });
    const waypointOut = buildEntry({
      mapName: 'Waypoint',
      nodeName: 'Waypoint Out',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'detour-in' }],
      }),
    });
    const detourIn = buildEntry({
      mapName: 'CraggledMire',
      nodeName: 'Detour In',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'detour-in' }],
      }),
    });

    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'TeleportNode'
        ? [directOut, directIn, detourOut, waypointIn, waypointOut, detourIn]
        : [],
    );
    vi.mocked(isWorldNodeCollectibleGateMet).mockImplementation(
      (entry) =>
        entry.nodeName !== 'Direct Out' && entry.nodeName !== 'Direct In',
    );

    expect(mapHopsBetween('Carrina', 'CraggledMire')).toBe(2);
  });
});
