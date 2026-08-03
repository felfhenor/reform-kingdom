import { computed } from '@angular/core';
import { allMaps } from '@helpers/maps';
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
import { AStarFinder } from 'astar-typescript';

const DENSE_TILE_LAYER_NAME = 'Dense Tiles';
const DENSE_OBJECT_LAYER_NAME = 'Dense Objects';

function blockTilesForObject(
  matrix: number[][],
  map: TiledMap,
  object: TiledObject,
): void {
  const left = Math.floor(object.x / map.tilewidth);
  const right = Math.floor((object.x + object.width - 1) / map.tilewidth);
  const top = Math.floor((object.y - object.height) / map.tileheight);
  const bottom = Math.floor(object.y / map.tileheight) - 1;

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (y < 0 || y >= map.height || x < 0 || x >= map.width) continue;
      matrix[y][x] = 1;
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
    blockTilesForObject(matrix, map, object);
  });

  return matrix;
}

export const mapWalkabilityMatrices = computed<Map<string, number[][]>>(() => {
  const matrices = new Map<string, number[][]>();

  allMaps().forEach((gameMap, mapName) => {
    matrices.set(mapName, tiledMapWalkabilityMatrix(gameMap.data as TiledMap));
  });

  return matrices;
});

// A query-specific copy of the map's walkability matrix with every node tile
// blocked, except the `allowedTiles` (this query's own from/to endpoints) -
// so a path never cuts through some other, unrelated node along the way.
function walkabilityMatrixForQuery(
  mapName: string,
  allowedTiles: { x: number; y: number }[],
): number[][] | undefined {
  const baseMatrix = mapWalkabilityMatrices().get(mapName);
  if (!baseMatrix) return undefined;

  const matrix = baseMatrix.map((row) => [...row]);
  const nodesByX = worldNodeLookup().byPosition[mapName] ?? {};

  Object.entries(nodesByX).forEach(([xKey, byY]) => {
    const x = Number(xKey);

    Object.keys(byY).forEach((yKey) => {
      const y = Number(yKey);
      if (allowedTiles.some((tile) => tile.x === x && tile.y === y)) return;

      matrix[y][x] = 1;
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

  const matrix = walkabilityMatrixForQuery(mapName, [from, to]);
  if (!matrix) return undefined;

  const finder = new AStarFinder({
    grid: { matrix },
    diagonalAllowed: false,
    includeStartNode: false,
    includeEndNode: true,
  });

  const rawPath = finder.findPath(from, to);
  if (rawPath.length === 0) return undefined;

  return rawPath.map(
    ([x, y]): TravelStep => ({ kind: 'Move', mapName, x, y }),
  );
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
