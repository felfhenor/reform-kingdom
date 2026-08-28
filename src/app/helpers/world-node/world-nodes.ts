import { computed } from '@angular/core';
import { getEntry } from '@helpers/content';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { allMaps } from '@helpers/maps';
import { tiledMapGetLayer } from '@helpers/pixi/tiled-map';
import {
  isWorldNodeDiscovered,
  worldNodeDiscover,
} from '@helpers/world-node/world-node-discovery';
import type {
  CaravanContent,
  CollectibleId,
  EncounterContent,
  EncounterRandomContent,
  GameMap,
  GatheringContent,
  NodeOverrideContent,
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

// Returns the WorldNodeEntry (not a bare CurrentLocation) - callers need both its
// coordinates and its `.nodeName` (see worker-travel.ts).
export function kingdomNodeGet(): WorldNodeEntry | undefined {
  return worldNodesOfType('Kingdom')[0];
}

export function worldNodeEncounter(
  entry: WorldNodeEntry,
): EncounterContent | undefined {
  const content = getEntry<EncounterContent>(entry.nodeName);
  return content?.__type === 'encounter' ? content : undefined;
}

export function worldNodeGathering(
  entry: WorldNodeEntry,
): GatheringContent | undefined {
  const content = getEntry<GatheringContent>(entry.nodeName);
  return content?.__type === 'gathering' ? content : undefined;
}

export function worldNodeEncounterRandom(
  entry: WorldNodeEntry,
): EncounterRandomContent | undefined {
  const content = getEntry<EncounterRandomContent>(entry.nodeName);
  return content?.__type === 'encounterrandom' ? content : undefined;
}

export function worldNodeCaravan(
  entry: WorldNodeEntry,
): CaravanContent | undefined {
  const content = getEntry<CaravanContent>(entry.nodeName);
  return content?.__type === 'caravan' ? content : undefined;
}

// Lets a node have display text without being backed by an Encounter/Gathering entry.
export function worldNodeOverride(
  entry: WorldNodeEntry,
): NodeOverrideContent | undefined {
  const content = getEntry<NodeOverrideContent>(entry.nodeName);
  return content?.__type === 'nodeoverride' ? content : undefined;
}

// Only one content type ever matches a given node, so this `??` chain is safe.
export function isWorldNodeHidden(entry: WorldNodeEntry): boolean {
  return (
    worldNodeEncounter(entry)?.hidden ??
    worldNodeGathering(entry)?.hidden ??
    worldNodeEncounterRandom(entry)?.hidden ??
    worldNodeOverride(entry)?.hidden ??
    false
  );
}

// Only one content type ever matches a given node, so this `??` chain is safe.
export function worldNodeCollectibleGateIds(
  entry: WorldNodeEntry,
): CollectibleId[] {
  return (
    worldNodeEncounter(entry)?.invisibleUntilCollectibleIdsFound ??
    worldNodeGathering(entry)?.invisibleUntilCollectibleIdsFound ??
    worldNodeEncounterRandom(entry)?.invisibleUntilCollectibleIdsFound ??
    worldNodeCaravan(entry)?.invisibleUntilCollectibleIdsFound ??
    worldNodeOverride(entry)?.invisibleUntilCollectibleIdsFound ??
    []
  );
}

// Nodes with no gate are always met; gated nodes need every listed collectible found.
export function isWorldNodeCollectibleGateMet(entry: WorldNodeEntry): boolean {
  return worldNodeCollectibleGateIds(entry).every((collectibleId) =>
    isCollectibleDiscovered(collectibleId),
  );
}

// Gates the map label/cursor and auto-mode targeting; non-hidden nodes are always visible.
export function isWorldNodeVisible(entry: WorldNodeEntry): boolean {
  if (!isWorldNodeCollectibleGateMet(entry)) return false;
  return !isWorldNodeHidden(entry) || isWorldNodeDiscovered(entry.nodeName);
}

// Keeps the hidden/already-discovered check out of the map click handler.
export function worldNodeDiscoverIfHidden(entry: WorldNodeEntry): void {
  if (isWorldNodeHidden(entry) && !isWorldNodeDiscovered(entry.nodeName)) {
    worldNodeDiscover(entry.nodeName);
  }
}

// Masked to '???' when still hidden/undiscovered, so a location can't leak off-map.
export function worldNodeDisplayName(nodeName: string): string {
  const entry = worldNodeByName(nodeName);
  if (!entry) return nodeName;

  return isWorldNodeVisible(entry) ? nodeName : '???';
}
