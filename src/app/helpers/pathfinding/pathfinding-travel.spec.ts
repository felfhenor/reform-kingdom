import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/maps', () => ({
  allMaps: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  currentLocationGet: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeAt: vi.fn(() => undefined),
  worldNodeByName: vi.fn(),
  worldNodeLookup: vi.fn(),
  worldNodesOfType: vi.fn(),
}));

import { allMaps } from '@helpers/maps';
import {
  travelPathFrom,
  travelPathTo,
} from '@helpers/pathfinding/pathfinding-travel';
import { currentLocationGet } from '@helpers/world';
import {
  worldNodeByName,
  worldNodeLookup,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  GameMap,
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
    const wallLayer = {
      id: 1,
      name: 'Dense Tiles',
      type: 'tilelayer' as const,
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
    const pathTilesLayer = {
      id: 1,
      name: 'Path Tiles',
      type: 'tilelayer' as const,
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

  it('chains through two teleport hops when no single hop reaches the destination', () => {
    // Mirrors the real Carrina -> CraggledMire -> Larsian Desert route: Larsian Desert only
    // pairs with CraggledMire, not with the Kingdom's own map, so this needs two hops.
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
    });

    const toMire = buildEntry({
      mapName: 'Carrina',
      x: 2,
      y: 0,
      nodeName: 'To Mire',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'mire-from-carrina' }],
      }),
    });
    const fromCarrina = buildEntry({
      mapName: 'CraggledMire',
      x: 0,
      y: 0,
      nodeName: 'From Carrina',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'mire-from-carrina' }],
      }),
    });
    const toLarsia = buildEntry({
      mapName: 'CraggledMire',
      x: 3,
      y: 0,
      nodeName: 'To Larsia',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'larsia-from-mire' }],
      }),
    });
    const fromMire = buildEntry({
      mapName: 'Larsia',
      x: 0,
      y: 0,
      nodeName: 'From Mire',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'larsia-from-mire' }],
      }),
    });

    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'TeleportNode'
        ? [toMire, fromCarrina, toLarsia, fromMire]
        : [],
    );
    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({ mapName: 'Larsia', x: 2, y: 0, nodeName: 'Mescalin Expanse' }),
    );
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(5, 5) }],
        ['CraggledMire', { name: 'CraggledMire', data: buildOpenMap(5, 5) }],
        ['Larsia', { name: 'Larsia', data: buildOpenMap(5, 5) }],
      ]),
    );

    expect(travelPathTo('Mescalin Expanse')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 1, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 2, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 3, y: 0 },
      { kind: 'Teleport', mapName: 'Larsia', x: 0, y: 0 },
      { kind: 'Move', mapName: 'Larsia', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Larsia', x: 2, y: 0 },
    ]);
  });

  it('picks the cheaper of two competing teleport routes, not just the first one found', () => {
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
    });

    // Listed before the cheaper exit, so a "first match wins" router would pick this one instead.
    const farExit = buildEntry({
      mapName: 'Carrina',
      x: 4,
      y: 0,
      nodeName: 'Far Exit',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'to-cm' }],
      }),
    });
    const nearExit = buildEntry({
      mapName: 'Carrina',
      x: 1,
      y: 0,
      nodeName: 'Near Exit',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'to-cm' }],
      }),
    });
    const arrival = buildEntry({
      mapName: 'CraggledMire',
      x: 0,
      y: 0,
      nodeName: 'CM Entrance',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'to-cm' }],
      }),
    });

    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'TeleportNode' ? [farExit, nearExit, arrival] : [],
    );
    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({ mapName: 'CraggledMire', x: 0, y: 2, nodeName: 'Some Place' }),
    );
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(5, 5) }],
        ['CraggledMire', { name: 'CraggledMire', data: buildOpenMap(5, 5) }],
      ]),
    );

    expect(travelPathTo('Some Place')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 0, y: 1 },
      { kind: 'Move', mapName: 'CraggledMire', x: 0, y: 2 },
    ]);
  });

  it('returns undefined when no teleport chain connects to the destination map at all', () => {
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
    });

    // A teleport node exists, but it leads to a map with no further connection to Larsia.
    const toMire = buildEntry({
      mapName: 'Carrina',
      x: 2,
      y: 0,
      nodeName: 'To Mire',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'mire-from-carrina' }],
      }),
    });
    const fromCarrina = buildEntry({
      mapName: 'CraggledMire',
      x: 0,
      y: 0,
      nodeName: 'From Carrina',
      nodeData: buildObject({
        type: 'TeleportNode',
        properties: [{ name: 'tag', type: 'string', value: 'mire-from-carrina' }],
      }),
    });

    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'TeleportNode' ? [toMire, fromCarrina] : [],
    );
    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({ mapName: 'Larsia', x: 2, y: 0, nodeName: 'Mescalin Expanse' }),
    );
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(5, 5) }],
        ['CraggledMire', { name: 'CraggledMire', data: buildOpenMap(5, 5) }],
        ['Larsia', { name: 'Larsia', data: buildOpenMap(5, 5) }],
      ]),
    );

    expect(travelPathTo('Mescalin Expanse')).toBeUndefined();
  });
});

describe('travelPathFrom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(worldNodeLookup).mockReturnValue(buildEmptyLookup());
  });

  // travelPathTo just calls this with currentLocationGet() - confirms a non-party
  // origin works too, which is what worker travel relies on.
  it('paths from an arbitrary origin, not just the current location', () => {
    vi.mocked(worldNodeByName).mockReturnValue(
      buildEntry({ mapName: 'Carrina', x: 2, y: 0, nodeName: 'Field Ruins' }),
    );
    vi.mocked(allMaps).mockReturnValue(
      new Map<string, GameMap>([
        ['Carrina', { name: 'Carrina', data: buildOpenMap(5, 5) }],
      ]),
    );

    expect(
      travelPathFrom({ mapName: 'Carrina', x: 0, y: 0 }, 'Field Ruins'),
    ).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
    ]);
    expect(currentLocationGet).not.toHaveBeenCalled();
  });

  it('returns undefined when the destination node does not exist', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(
      travelPathFrom({ mapName: 'Carrina', x: 0, y: 0 }, 'Nowhere'),
    ).toBeUndefined();
  });
});
