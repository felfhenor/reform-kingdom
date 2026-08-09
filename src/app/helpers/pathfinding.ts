import { computed } from '@angular/core';
import { allMaps } from '@helpers/maps';
import { weightedGridPathFind } from '@helpers/pathfinding-astar';
import {
  tiledLayerTileAt,
  tiledMapGetLayer,
  tiledObjectProperty,
} from '@helpers/tiled-map';
import { currentLocationGet } from '@helpers/world';
import {
  worldNodeByName,
  worldNodeLookup,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type {
  CurrentLocation,
  TiledMap,
  TiledObject,
  TravelStep,
  WorldNodeEntry,
} from '@interfaces';

const DENSE_TILE_LAYER_NAME = 'Dense Tiles';
const DENSE_OBJECT_LAYER_NAME = 'Dense Objects';
const PATH_TILE_LAYER_NAME = 'Path Tiles';
const PATH_OBJECT_LAYER_NAME = 'Path Objects';

// Stepping onto a tile marked by the Path Tiles/Path Objects layers is
// cheaper than stepping onto any other open tile, so pathfinding prefers to
// hug authored paths without ever treating off-road tiles as impassable.
const ON_PATH_MOVE_COST = 1;
const OFF_PATH_MOVE_COST = 4;

// The object's own (x, y) is its rotation pivot - the bottom-left corner of
// its *unrotated* footprint - matching how `pixiTiledObjectRender` renders
// it. Rotating the four corners around that pivot (rather than trusting the
// raw x/y/width/height box) is what makes a rotated bend tile - as used by
// Path Objects at corners - resolve to the grid cell it's actually drawn
// into, not the one its unrotated footprint would suggest.
function objectWorldCorners(object: TiledObject): { x: number; y: number }[] {
  const angle = ((object.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    { x: 0, y: 0 },
    { x: object.width, y: 0 },
    { x: 0, y: -object.height },
    { x: object.width, y: -object.height },
  ].map(({ x, y }) => ({
    x: object.x + x * cos - y * sin,
    y: object.y + x * sin + y * cos,
  }));
}

function forEachObjectTile(
  map: TiledMap,
  object: TiledObject,
  callback: (x: number, y: number) => void,
): void {
  const corners = objectWorldCorners(object);
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);

  const left = Math.floor(Math.min(...xs) / map.tilewidth);
  const right = Math.ceil(Math.max(...xs) / map.tilewidth) - 1;
  const top = Math.floor(Math.min(...ys) / map.tileheight);
  const bottom = Math.ceil(Math.max(...ys) / map.tileheight) - 1;

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (y < 0 || y >= map.height || x < 0 || x >= map.width) continue;
      callback(x, y);
    }
  }
}

export function tiledMapWalkabilityMatrix(map: TiledMap): number[][] {
  const matrix: number[][] = Array.from({ length: map.height }, () =>
    new Array(map.width).fill(0),
  );

  const denseTileLayer = tiledMapGetLayer(map, DENSE_TILE_LAYER_NAME);
  if (denseTileLayer) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tiledLayerTileAt(denseTileLayer, x, y) !== 0) {
          matrix[y][x] = 1;
        }
      }
    }
  }

  const denseObjectLayer = tiledMapGetLayer(map, DENSE_OBJECT_LAYER_NAME);
  (denseObjectLayer?.objects ?? []).forEach((object) => {
    forEachObjectTile(map, object, (x, y) => {
      matrix[y][x] = 1;
    });
  });

  return matrix;
}

// Marks every tile the Path Tiles/Path Objects layers cover as "on path" -
// the preferred (but not exclusive) route for in-map pathfinding.
export function tiledMapPathMatrix(map: TiledMap): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: map.height }, () =>
    new Array(map.width).fill(false),
  );

  const pathTileLayer = tiledMapGetLayer(map, PATH_TILE_LAYER_NAME);
  if (pathTileLayer) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tiledLayerTileAt(pathTileLayer, x, y) !== 0) {
          matrix[y][x] = true;
        }
      }
    }
  }

  const pathObjectLayer = tiledMapGetLayer(map, PATH_OBJECT_LAYER_NAME);
  (pathObjectLayer?.objects ?? []).forEach((object) => {
    forEachObjectTile(map, object, (x, y) => {
      matrix[y][x] = true;
    });
  });

  return matrix;
}

// Combines walkability and path preference into a single per-tile move cost:
// impassable tiles are infinitely expensive, path tiles are cheap, and every
// other open tile is more expensive - so pathfinding is drawn to paths
// without off-roading ever being blocked outright.
export function tiledMapMoveCostMatrix(map: TiledMap): number[][] {
  const blocked = tiledMapWalkabilityMatrix(map);
  const onPath = tiledMapPathMatrix(map);

  return blocked.map((row, y) =>
    row.map((isBlocked, x) =>
      isBlocked
        ? Number.POSITIVE_INFINITY
        : onPath[y][x]
          ? ON_PATH_MOVE_COST
          : OFF_PATH_MOVE_COST,
    ),
  );
}

export const mapMoveCostMatrices = computed<Map<string, number[][]>>(() => {
  const matrices = new Map<string, number[][]>();

  allMaps().forEach((gameMap, mapName) => {
    matrices.set(mapName, tiledMapMoveCostMatrix(gameMap.data as TiledMap));
  });

  return matrices;
});

// A query-specific copy of the map's move cost matrix with every node tile
// blocked, except the `allowedTiles` (this query's own from/to endpoints) -
// so a path never cuts through some other, unrelated node along the way.
function moveCostMatrixForQuery(
  mapName: string,
  allowedTiles: { x: number; y: number }[],
): number[][] | undefined {
  const baseMatrix = mapMoveCostMatrices().get(mapName);
  if (!baseMatrix) return undefined;

  const matrix = baseMatrix.map((row) => [...row]);
  const nodesByX = worldNodeLookup().byPosition[mapName] ?? {};

  Object.entries(nodesByX).forEach(([xKey, byY]) => {
    const x = Number(xKey);

    Object.keys(byY).forEach((yKey) => {
      const y = Number(yKey);
      if (allowedTiles.some((tile) => tile.x === x && tile.y === y)) return;

      matrix[y][x] = Number.POSITIVE_INFINITY;
    });
  });

  return matrix;
}

function findInMapPath(
  mapName: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
): TravelStep[] | undefined {
  if (from.x === to.x && from.y === to.y) return [];

  const matrix = moveCostMatrixForQuery(mapName, [from, to]);
  if (!matrix) return undefined;

  const rawPath = weightedGridPathFind(matrix, from, to);
  if (!rawPath) return undefined;

  return rawPath
    .slice(1)
    .map(({ x, y }): TravelStep => ({ kind: 'Move', mapName, x, y }));
}

function teleportNodeProperty(
  node: WorldNodeEntry,
  name: 'tag' | 'toTag',
): string | undefined {
  return tiledObjectProperty<string>(node.nodeData, name);
}

// Tags are validated unique across every map (see
// scripts/validate-teleportnodes.ts), so a `toTag` resolves to exactly one
// `tag` regardless of which map it lives on.
function findTeleportArrivalByTag(tag: string): WorldNodeEntry | undefined {
  return worldNodesOfType('TeleportNode').find(
    (node) => teleportNodeProperty(node, 'tag') === tag,
  );
}

// Walks to a TeleportNode on the current map and appends the instant jump to
// its paired arrival tile - the building block for both traveling directly
// to a TeleportNode and for using one as a waypoint into `travelPathAcrossMaps`.
function travelPathViaTeleport(
  location: CurrentLocation,
  teleportNode: WorldNodeEntry,
): TravelStep[] | undefined {
  if (location.mapName !== teleportNode.mapName) return undefined;

  const toTag = teleportNodeProperty(teleportNode, 'toTag');
  if (!toTag) return undefined;

  const arrival = findTeleportArrivalByTag(toTag);
  if (!arrival) return undefined;

  const toTeleportSteps = findInMapPath(location.mapName, location, teleportNode);
  if (!toTeleportSteps) return undefined;

  const teleportStep: TravelStep = {
    kind: 'Teleport',
    mapName: arrival.mapName,
    x: arrival.x,
    y: arrival.y,
  };

  return [...toTeleportSteps, teleportStep];
}

function travelPathAcrossMaps(
  location: CurrentLocation,
  destination: WorldNodeEntry,
): TravelStep[] | undefined {
  const teleportsOnStartMap = worldNodesOfType('TeleportNode').filter(
    (node) => node.mapName === location.mapName,
  );

  for (const teleport of teleportsOnStartMap) {
    const toTeleportPath = travelPathViaTeleport(location, teleport);
    if (!toTeleportPath) continue;

    const arrival = toTeleportPath[toTeleportPath.length - 1];
    const fromArrivalSteps = findInMapPath(
      destination.mapName,
      arrival,
      destination,
    );
    if (!fromArrivalSteps) continue;

    return [...toTeleportPath, ...fromArrivalSteps];
  }

  return undefined;
}

export function travelPathTo(
  destinationNodeName: string,
): TravelStep[] | undefined {
  const destination = worldNodeByName(destinationNodeName);
  if (!destination) return undefined;

  const location = currentLocationGet();

  // Traveling "to" a TeleportNode means crossing it, not just standing next
  // to it - so the jump to its paired arrival tile is part of this path.
  if (destination.nodeData.type === 'TeleportNode') {
    return travelPathViaTeleport(location, destination);
  }

  if (location.mapName === destination.mapName) {
    return findInMapPath(location.mapName, location, destination);
  }

  return travelPathAcrossMaps(location, destination);
}

// Neighboring maps reachable by a single teleport hop from `mapName`.
function mapGraphNeighbors(mapName: string): string[] {
  return worldNodesOfType('TeleportNode')
    .filter((node) => node.mapName === mapName)
    .map((node) => teleportNodeProperty(node, 'toTag'))
    .filter((tag): tag is string => !!tag)
    .map((tag) => findTeleportArrivalByTag(tag)?.mapName)
    .filter((neighborMapName): neighborMapName is string => !!neighborMapName);
}

// Fewest teleport hops needed to get from one map to another - used to scale
// how long Deaths Door lasts based on how far from the kingdom's map the
// party died (see `helpers/travel.ts`).
export function mapHopsBetween(fromMapName: string, toMapName: string): number {
  if (fromMapName === toMapName) return 0;

  const visited = new Set<string>([fromMapName]);
  let frontier = [fromMapName];
  let hops = 0;

  while (frontier.length > 0) {
    hops++;
    const nextFrontier: string[] = [];

    for (const mapName of frontier) {
      for (const neighborMapName of mapGraphNeighbors(mapName)) {
        if (neighborMapName === toMapName) return hops;
        if (visited.has(neighborMapName)) continue;

        visited.add(neighborMapName);
        nextFrontier.push(neighborMapName);
      }
    }

    frontier = nextFrontier;
  }

  return hops;
}
