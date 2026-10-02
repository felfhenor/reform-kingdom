import '@/testing/reset';
import { setAllMaps } from '@helpers/maps';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  GameMap,
  TiledMap,
  TiledObject,
  WorldNodeEntry,
  WorldNodeType,
} from '@interfaces';

const TILE_SIZE = 16;
const DEFAULT_MAP = 'TestMap';

// Replaces all maps with minimal Tiled maps so the real node lookups (by name, position and type) resolve these nodes.
export function seedWorldNodes(
  nodes: {
    name: string;
    type: WorldNodeType;
    mapName?: string;
    x?: number;
    y?: number;
    properties?: TiledObject['properties'];
  }[],
): Record<string, WorldNodeEntry> {
  const objectsByMap = new Map<string, TiledObject[]>();

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

  const maps = new Map<string, GameMap>();
  objectsByMap.forEach((objects, mapName) => {
    const data: TiledMap = {
      width: 100,
      height: 100,
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      tilesets: [],
      layers: [
        {
          id: 1,
          name: 'Explore Nodes',
          type: 'objectgroup',
          visible: true,
          objects,
        },
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
