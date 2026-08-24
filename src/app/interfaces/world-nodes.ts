import type { AtlasedImage } from '@interfaces/artable';
import type { RewardIdentity } from '@interfaces/droppable';
import type { TiledObject } from '@interfaces/tiled-map';

export type WorldNodeHideable = {
  // When true, name/level label and map cursor stay hidden until discovered (see world-node-discovery.ts).
  hidden?: boolean;
};

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

export type WorldNodeInteractionKind =
  'Gather' | 'Explore' | 'ExploreRandom' | 'Trade' | 'Travel';

export type WorldNodeCompletionRewardProgress = {
  obtained: number;
  total: number;
};

// `current` is 1-based (the fight in progress); `total` is the encounter's fight count.
export type WorldNodeEncounterProgress = {
  current: number;
  total: number;
  fraction: number;
};

export type WorldNodeLabelInfo = {
  kind: WorldNodeInteractionKind;
  text: string;
};

export type PixiNodeLabelResolver = (
  object: TiledObject,
) => WorldNodeLabelInfo | undefined;

// Resolved reward display info, for use outside a full SlotCompletionRewardComponent.
export type RewardContentInfo = {
  name: string;
  sprite: string;
  spritesheet: AtlasedImage;
};

// Carries the full entry (not a precomputed sprite frame) so SpriteNodeComponent can resolve it.
export type ExploreNodeFarmOption = {
  nodeName: string;
  levelLabel: string;
  entry: WorldNodeEntry;
};

// One option in the Farm Node clause's reward picker, scoped to a single
// node's completion rewards.
export type FarmNodeRewardOption = RewardContentInfo & {
  key: string;
  reward: RewardIdentity;
};
