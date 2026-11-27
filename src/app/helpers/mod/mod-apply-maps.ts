import { allMaps, setAllMaps } from '@helpers/maps';
import { tiledMapWalkabilityMatrix } from '@helpers/pathfinding/pathfinding';
import { tiledMapGetLayer } from '@helpers/pixi/tiled-map';
import {
  tiledObjectTilePosition,
  worldNodeMapsBuild,
} from '@helpers/world-node/world-nodes';
import { max } from 'es-toolkit/compat';
import type {
  GameMap,
  ModBundle,
  ModMapPatch,
  TiledMap,
  TiledObject,
} from '@interfaces';

const NODE_LAYER_NAME = 'Explore Nodes';

function modMapNodeNames(maps: Map<string, GameMap>): Set<string> {
  return new Set(Object.keys(worldNodeMapsBuild(maps).byName));
}

function modMapObjectError(
  map: TiledMap,
  object: TiledObject,
  takenNames: Set<string>,
): string | undefined {
  if (!object.name) return 'a map object has no name.';
  if (takenNames.has(object.name)) {
    return `node "${object.name}" already exists on another map.`;
  }

  const { x, y } = tiledObjectTilePosition(map, object);
  const blocked = tiledMapWalkabilityMatrix(map)[y]?.[x];
  if (blocked !== 0) return `node "${object.name}" is not on a walkable tile.`;
  return undefined;
}

function modMapWithObjects(map: TiledMap, objects: TiledObject[]): TiledMap {
  const copy = structuredClone(map);
  const layer = tiledMapGetLayer(copy, NODE_LAYER_NAME);
  const allObjects = copy.layers.flatMap((l) => l.objects ?? []);
  let nextId = (max(allObjects.map((object) => object.id)) ?? 0) + 1;

  objects.forEach((object) => {
    layer?.objects?.push({ ...object, id: nextId++ });
  });
  return copy;
}

function modMapPatchErrors(
  patch: ModMapPatch,
  maps: Map<string, GameMap>,
): string[] {
  const base = maps.get(patch.map)?.data as TiledMap | undefined;
  if (!base || !tiledMapGetLayer(base, NODE_LAYER_NAME)) {
    return [`Map patch: "${patch.map}" has no ${NODE_LAYER_NAME} layer.`];
  }

  const takenNames = modMapNodeNames(maps);
  return patch.objects
    .map((object) => modMapObjectError(base, object, takenNames))
    .filter((error) => error !== undefined)
    .map((error) => `${patch.map}: ${error}`);
}

function modApplyMapPatches(
  bundle: ModBundle,
  maps: Map<string, GameMap>,
  errors: string[],
): void {
  bundle.mapPatches.forEach((patch) => {
    const patchErrors = modMapPatchErrors(patch, maps);
    errors.push(...patchErrors);
    if (patchErrors.length > 0) return;

    const base = maps.get(patch.map)?.data as TiledMap;
    maps.set(patch.map, {
      name: patch.map,
      data: modMapWithObjects(base, patch.objects),
    });
  });
}

function modApplyNewMaps(
  bundle: ModBundle,
  maps: Map<string, GameMap>,
  errors: string[],
): void {
  Object.entries(bundle.maps).forEach(([name, data]) => {
    if (maps.has(name)) {
      errors.push(`${name}: a map with this name exists; use a map patch.`);
      return;
    }

    const takenNames = modMapNodeNames(maps);
    const clash = Object.keys(
      worldNodeMapsBuild(new Map([[name, { name, data }]])).byName,
    ).find((nodeName) => takenNames.has(nodeName));

    if (clash)
      errors.push(`${name}: node "${clash}" already exists elsewhere.`);
    else maps.set(name, { name, data });
  });
}

export function modApplyMaps(bundle: ModBundle): string[] {
  const errors: string[] = [];
  const maps = new Map(allMaps());
  modApplyNewMaps(bundle, maps, errors);
  modApplyMapPatches(bundle, maps, errors);
  setAllMaps(maps);
  return errors;
}
