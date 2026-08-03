import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/maps', () => ({
  allMaps: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  currentLocationGet: vi.fn(),
}));

vi.mock('@helpers/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeLookup: vi.fn(),
  worldNodesOfType: vi.fn(),
}));

import {
  mapHopsBetween,
  tiledMapWalkabilityMatrix,
  travelPathTo,
} from '@helpers/pathfinding';
import { allMaps } from '@helpers/maps';
import { currentLocationGet } from '@helpers/world';
import {
  worldNodeByName,
  worldNodeLookup,
  worldNodesOfType,
} from '@helpers/world-nodes';
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
      new Map<string, GameMap>([['Carrina', { name: 'Carrina', data: walledMap }]]),
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
