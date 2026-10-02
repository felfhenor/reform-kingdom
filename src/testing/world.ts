import '@/testing/reset';
import { setAllMaps } from '@helpers/maps';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  GameMap,
  TiledLayer,
  TiledMap,
  TiledObject,
  WorldNodeEntry,
  WorldNodeType,
} from '@interfaces';

const TILE_SIZE = 16;
const MAP_SIZE = 100;
const DEFAULT_MAP = 'TestMap';

function pathTileLayer(tiles: { x: number; y: number }[]): TiledLayer {
  const data = new Array<number>(MAP_SIZE * MAP_SIZE).fill(0);
  tiles.forEach(({ x, y }) => (data[y * MAP_SIZE + x] = 1));
  return {
    id: 2,
    name: 'Path Tiles',
    type: 'tilelayer',
    visible: true,
    width: MAP_SIZE,
    height: MAP_SIZE,
    data,
  };
}

// Replaces all maps with minimal Tiled maps so the real node lookups (by name, position and type) and path-tile checks resolve.
export function seedWorldNodes(
  nodes: {
    name: string;
    type: WorldNodeType;
    mapName?: string;
    x?: number;
    y?: number;
    properties?: TiledObject['properties'];
  }[],
  pathTiles: { mapName?: string; x: number; y: number }[] = [],
): Record<string, WorldNodeEntry> {
  const objectsByMap = new Map<string, TiledObject[]>();
  const pathsByMap = new Map<string, { x: number; y: number }[]>();

  nodes.forEach((node, index) => {
    const mapName = node.mapName ?? DEFAULT_MAP;
    const objects = objectsByMap.get(mapName) ?? [];
    const x = (node.x ?? index) * TILE_SIZE;
    const y = ((node.y ?? 0) + 1) * TILE_SIZE;
    if (objects.some((object) => object.x === x && object.y === y)) {
      throw new Error(`seedWorldNodes: ${node.name} overlaps another node`);
    }
    objects.push({
      id: index + 1,
      name: node.name,
      type: node.type,
      x,
      y,
      width: TILE_SIZE,
      height: TILE_SIZE,
      visible: true,
      properties: node.properties,
    });
    objectsByMap.set(mapName, objects);
  });

  pathTiles.forEach(({ mapName = DEFAULT_MAP, x, y }) => {
    pathsByMap.set(mapName, [...(pathsByMap.get(mapName) ?? []), { x, y }]);
  });

  const mapNames = new Set([...objectsByMap.keys(), ...pathsByMap.keys()]);
  const maps = new Map<string, GameMap>();
  mapNames.forEach((mapName) => {
    const data: TiledMap = {
      width: MAP_SIZE,
      height: MAP_SIZE,
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      tilesets: [],
      layers: [
        {
          id: 1,
          name: 'Explore Nodes',
          type: 'objectgroup',
          visible: true,
          objects: objectsByMap.get(mapName) ?? [],
        },
        pathTileLayer(pathsByMap.get(mapName) ?? []),
      ],
    };
    maps.set(mapName, { name: mapName, data });
  });
  setAllMaps(maps);

  return Object.fromEntries(
    nodes.map((node) => [node.name, worldNodeByName(node.name)!]),
  );
}

export function locationOf(entry: WorldNodeEntry): CurrentLocation {
  return { mapName: entry.mapName, x: entry.x, y: entry.y };
}
