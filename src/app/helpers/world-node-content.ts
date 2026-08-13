import { getMap } from '@helpers/maps';
import { tiledObjectSpriteFrame } from '@helpers/tiled-map';
import {
  worldNodeCaravan,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
  worldNodeOverride,
} from '@helpers/world-nodes';
import type {
  TiledMap,
  TiledObjectSpriteFrame,
  WorldNodeEntry,
} from '@interfaces';

export function worldNodeDescription(
  entry: WorldNodeEntry,
): string | undefined {
  return (
    worldNodeOverride(entry)?.description ??
    worldNodeEncounter(entry)?.description ??
    worldNodeGathering(entry)?.description ??
    worldNodeEncounterRandom(entry)?.description ??
    worldNodeCaravan(entry)?.description
  );
}

// The map tile this node renders as - the same sprite `map-node-panel` shows
// for the currently-selected node, resolved here so any UI that lists nodes
// off-map (e.g. the Farm Node clause's node picker) can show it too.
export function worldNodeSpriteFrame(
  entry: WorldNodeEntry,
): TiledObjectSpriteFrame | undefined {
  const map = getMap(entry.mapName)?.data as TiledMap | undefined;
  if (!map) return undefined;

  return tiledObjectSpriteFrame(map, entry.nodeData);
}
