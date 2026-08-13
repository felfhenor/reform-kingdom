import { computed } from '@angular/core';
import { getEntry } from '@helpers/content';
import { allMaps } from '@helpers/maps';
import { tiledMapGetLayer } from '@helpers/tiled-map';
import {
  isWorldNodeDiscovered,
  worldNodeDiscover,
} from '@helpers/world-node-discovery';
import type {
  CaravanContent,
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

// A manually-authored override for a node's displayed data - lets a node
// (e.g. a Kingdom node like the Duchy of Carrina) have text like a
// description without needing to be backed by an Encounter/Gathering entry.
export function worldNodeOverride(
  entry: WorldNodeEntry,
): NodeOverrideContent | undefined {
  const content = getEntry<NodeOverrideContent>(entry.nodeName);
  return content?.__type === 'nodeoverride' ? content : undefined;
}

// Whether `entry` is authored as hidden - checks whichever content type it
// actually resolves to (only one of the four ever matches a given node, so
// this `??` chain is safe).
export function isWorldNodeHidden(entry: WorldNodeEntry): boolean {
  return (
    worldNodeEncounter(entry)?.hidden ??
    worldNodeGathering(entry)?.hidden ??
    worldNodeEncounterRandom(entry)?.hidden ??
    worldNodeOverride(entry)?.hidden ??
    false
  );
}

// A hidden node is only visible once the player has clicked/discovered it -
// every other node is always visible. Gates the map label/cursor (see
// `worldNodeLabelInfo`, `pixi-map-render.ts`) and auto-mode targeting (see
// `decree-evaluation.ts`).
export function isWorldNodeVisible(entry: WorldNodeEntry): boolean {
  return !isWorldNodeHidden(entry) || isWorldNodeDiscovered(entry.nodeName);
}

// Reveals `entry` if it's hidden and not yet discovered - the single call
// site the map click handler uses, so the hidden/already-discovered
// conditional lives here rather than in the component.
export function worldNodeDiscoverIfHidden(entry: WorldNodeEntry): void {
  if (isWorldNodeHidden(entry) && !isWorldNodeDiscovered(entry.nodeName)) {
    worldNodeDiscover(entry.nodeName);
  }
}

// The name to show for `nodeName` anywhere it's surfaced off-map (bestiary,
// museum, etc.) - masked to '???' if it's a still-undiscovered hidden node,
// so a location can't leak before the player has actually found it.
export function worldNodeDisplayName(nodeName: string): string {
  const entry = worldNodeByName(nodeName);
  if (!entry) return nodeName;

  return isWorldNodeVisible(entry) ? nodeName : '???';
}
