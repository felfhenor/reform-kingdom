import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/maps', () => ({
  allMaps: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  currentLocationGet: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeLookup: vi.fn(),
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
  travelPathTo,
} from '@helpers/pathfinding/pathfinding';
import { currentLocationGet } from '@helpers/world';
import {
  worldNodeByName,
  worldNodeLookup,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  GameMap,
  TiledLayer,
  TiledMap,
  TiledObject,
  WorldNodeEntry,
  WorldNodeLookup,
} from '@interfaces';

function buildEmptyLookup(): WorldNodeLookup {
  return { byPosition: {}, byName: {} };
}

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

describe('travelPathTo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(worldNodeLookup).mockReturnValue(buildEmptyLookup());
  });

  it('returns an empty path when already at the destination', () => {
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 2,
      y: 2,
    });
    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({ mapName: 'Carrina', x: 2, y: 2, nodeName: 'Field Ruins' }),
    );
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(5, 5) }],
      ]),
    );

    expect(travelPathTo('Field Ruins')).toEqual([]);
  });

  it('returns an in-map Move path on an open grid', () => {
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
    });
    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({ mapName: 'Carrina', x: 2, y: 0, nodeName: 'Field Ruins' }),
    );
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(5, 5) }],
      ]),
    );

    expect(travelPathTo('Field Ruins')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
    ]);
  });

  it('returns undefined when no path exists on the current map', () => {
    const wallLayer: TiledLayer = {
      id: 1,
      name: 'Dense Tiles',
      type: 'tilelayer',
      visible: true,
      width: 3,
      height: 3,
      data: [0, 1, 0, 0, 1, 0, 0, 1, 0],
    };
    const walledMap: TiledMap = { ...buildOpenMap(3, 3), layers: [wallLayer] };

    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 1,
    });
    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({ mapName: 'Carrina', x: 2, y: 1, nodeName: 'Field Ruins' }),
    );
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: walledMap }],
      ]),
    );

    expect(travelPathTo('Field Ruins')).toBeUndefined();
  });

  it('returns undefined when the destination node does not exist', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(travelPathTo('Nowhere')).toBeUndefined();
  });

  it('composes a cross-map path through a matching TeleportNode pair', () => {
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
    });

    const teleportOut = buildEntry({
      mapName: 'Carrina',
      x: 2,
      y: 0,
      nodeName: 'To Craggled Mire',
      nodeData: buildObject({
        name: 'To Craggled Mire',
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'from-carrina' }],
      }),
    });

    const teleportIn = buildEntry({
      mapName: 'CraggledMire',
      x: 0,
      y: 0,
      nodeName: 'To Carrina',
      nodeData: buildObject({
        name: 'To Carrina',
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'from-carrina' }],
      }),
    });

    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'TeleportNode' ? [teleportOut, teleportIn] : [],
    );

    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({
        mapName: 'CraggledMire',
        x: 2,
        y: 0,
        nodeName: 'Forest Ruins',
      }),
    );

    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(5, 5) }],
        ['CraggledMire', { name: 'CraggledMire', data: buildOpenMap(5, 5) }],
      ]),
    );

    expect(travelPathTo('Forest Ruins')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 1, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 2, y: 0 },
    ]);
  });

  it('travels through a TeleportNode when it is the destination itself, not just a waypoint', () => {
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
    });

    const teleportOut = buildEntry({
      mapName: 'Carrina',
      x: 2,
      y: 0,
      nodeName: 'To Craggled Mire',
      nodeData: buildObject({
        name: 'To Craggled Mire',
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'from-carrina' }],
      }),
    });

    const teleportIn = buildEntry({
      mapName: 'CraggledMire',
      x: 0,
      y: 0,
      nodeName: 'To Carrina',
      nodeData: buildObject({
        name: 'To Carrina',
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'from-carrina' }],
      }),
    });

    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'TeleportNode' ? [teleportOut, teleportIn] : [],
    );
    vi.mocked(worldNodeByName).mockReturnValue(teleportOut);
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(5, 5) }],
        ['CraggledMire', { name: 'CraggledMire', data: buildOpenMap(5, 5) }],
      ]),
    );

    expect(travelPathTo('To Craggled Mire')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 },
    ]);
  });

  it('routes around a node tile that is not the destination', () => {
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 1,
    });
    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({ mapName: 'Carrina', x: 2, y: 1, nodeName: 'Field Ruins' }),
    );
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(3, 3) }],
      ]),
    );
    vi.mocked(worldNodeLookup).mockReturnValue({
      byPosition: {
        Carrina: {
          1: {
            1: buildEntry({
              mapName: 'Carrina',
              x: 1,
              y: 1,
              nodeName: 'Some Other Node',
            }),
          },
        },
      },
      byName: {},
    });

    const path = travelPathTo('Field Ruins');

    expect(path).not.toBeUndefined();
    expect(path?.some((step) => step.x === 1 && step.y === 1)).toBe(false);
  });

  it('detours onto a longer Path Tiles route instead of the shortest off-road one', () => {
    // Row 0 is an authored path; the shorter off-road diagonal route costs more than the longer on-path one.
    const pathTilesLayer: TiledLayer = {
      id: 1,
      name: 'Path Tiles',
      type: 'tilelayer',
      visible: true,
      width: 5,
      height: 5,
      data: [
        7, 7, 7, 7, 7, 0, 0, 0, 0, 7, 0, 0, 0, 0, 7, 0, 0, 0, 0, 7, 0, 0, 0, 0,
        7,
      ],
    };
    const map: TiledMap = { ...buildOpenMap(5, 5), layers: [pathTilesLayer] };

    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
    });
    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({ mapName: 'Carrina', x: 4, y: 4, nodeName: 'Field Ruins' }),
    );
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([['Carrina', { name: 'Carrina', data: map }]]),
    );

    const path = travelPathTo('Field Ruins');

    expect(path).not.toBeUndefined();
    expect(path?.every((step) => step.x === 4 || step.y === 0)).toBe(true);
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
});
