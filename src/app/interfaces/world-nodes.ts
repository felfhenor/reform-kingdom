import type { TiledObject } from '@interfaces/tiled-map';

export type WorldNodeEntry = {
  mapName: string;
  x: number;
  y: number;
  nodeName: string;
  nodeData: TiledObject;
};

export type WorldNodePositionMap = Record<
  string,
  Record<number, Record<number, WorldNodeEntry>>
>;

export type WorldNodeNameMap = Record<string, WorldNodeEntry>;

export type WorldNodeLookup = {
  byPosition: WorldNodePositionMap;
  byName: WorldNodeNameMap;
};

export type WorldNodeInteractionKind = 'Gather' | 'Explore' | 'Travel';

export type WorldNodeLabelInfo = {
  kind: WorldNodeInteractionKind;
  text: string;
};

export type PixiNodeLabelResolver = (
  object: TiledObject,
) => WorldNodeLabelInfo | undefined;
