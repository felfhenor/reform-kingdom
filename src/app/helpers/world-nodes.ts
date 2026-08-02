import { computed } from '@angular/core';
import { getEntry } from '@helpers/content';
import { allMaps } from '@helpers/maps';
import { tiledMapGetLayer } from '@helpers/tiled-map';
import type {
  EncounterContent,
  EncounterLevelRange,
  GameMap,
  TiledMap,
  TiledObject,
  WorldNodeEntry,
  WorldNodeLookup,
  WorldNodeNameMap,
  WorldNodePositionMap,
  WorldNodeType,
} from '@interfaces';

const NODE_LAYER_NAMES = ['Explore Nodes', 'Other Nodes'];

function tiledObjectTilePosition(
  map: TiledMap,
  object: TiledObject,
): { x: number; y: number } {
  return {
    x: Math.floor(object.x / map.tilewidth),
    y: Math.floor(object.y / map.tileheight) - 1,
  };
}

export function worldNodeMapsBuild(
  maps: Map<string, GameMap>,
): WorldNodeLookup {
  const byPosition: WorldNodePositionMap = {};
  const byName: WorldNodeNameMap = {};

  maps.forEach((gameMap, mapName) => {
    const tiledMap = gameMap.data as TiledMap;

    NODE_LAYER_NAMES.forEach((layerName) => {
      const layer = tiledMapGetLayer(tiledMap, layerName);

      (layer?.objects ?? []).forEach((object) => {
        const { x, y } = tiledObjectTilePosition(tiledMap, object);
        const entry: WorldNodeEntry = {
          mapName,
          x,
          y,
          nodeName: object.name,
          nodeData: object,
        };

        byPosition[mapName] ??= {};
        byPosition[mapName][x] ??= {};
        byPosition[mapName][x][y] = entry;

        byName[object.name] = entry;
      });
    });
  });

  return { byPosition, byName };
}

export const worldNodeLookup = computed(() => worldNodeMapsBuild(allMaps()));

export function worldNodeAt(
  mapName: string,
  x: number,
  y: number,
): WorldNodeEntry | undefined {
  return worldNodeLookup().byPosition[mapName]?.[x]?.[y];
}

export function worldNodeByName(nodeName: string): WorldNodeEntry | undefined {
  return worldNodeLookup().byName[nodeName];
}

export function worldNodesOfType(type: WorldNodeType): WorldNodeEntry[] {
  return Object.values(worldNodeLookup().byName).filter(
    (entry) => entry.nodeData.type === type,
  );
}

export function worldNodeEncounter(
  entry: WorldNodeEntry,
): EncounterContent | undefined {
  return getEntry<EncounterContent>(entry.nodeName);
}

export function worldNodeLevelRange(
  entry: WorldNodeEntry,
): EncounterLevelRange | undefined {
  return worldNodeEncounter(entry)?.levelRange;
}

export function worldNodeMonsterCount(entry: WorldNodeEntry): number | undefined {
  const encounter = worldNodeEncounter(entry);
  if (!encounter) return undefined;

  return encounter.fights.reduce(
    (total, fight) => total + fight.monsters.length,
    0,
  );
}

export function worldNodeDescription(entry: WorldNodeEntry): string | undefined {
  return worldNodeEncounter(entry)?.description;
}
