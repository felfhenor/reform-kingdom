import type { AtlasedImage } from '@interfaces/artable';
import type { RewardIdentity } from '@interfaces/droppable';
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

export type WorldNodeInteractionKind =
  | 'Gather'
  | 'Explore'
  | 'ExploreRandom'
  | 'Trade'
  | 'Travel';

export type WorldNodeCompletionRewardProgress = {
  obtained: number;
  total: number;
};

export type WorldNodeLabelInfo = {
  kind: WorldNodeInteractionKind;
  text: string;
};

export type PixiNodeLabelResolver = (
  object: TiledObject,
) => WorldNodeLabelInfo | undefined;

// Display info for a reward, resolved down to its underlying content -
// used anywhere a reward needs to be shown outside of a full
// `CompletionRewardSlotComponent` (e.g. a Decree clause's farm target).
export type RewardContentInfo = {
  name: string;
  sprite: string;
  spritesheet: AtlasedImage;
};

// One option in the Farm Node clause's node picker. Carries the full entry
// (rather than a precomputed sprite frame) so the picker can render it
// through the reusable `NodeSpriteComponent`, which resolves the frame
// itself.
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
