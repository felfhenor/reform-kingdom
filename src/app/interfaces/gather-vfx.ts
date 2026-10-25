import type { RewardContentInfo } from '@interfaces/world-nodes';

// Fired when something is granted or revealed at a node, so the map can pop a floating "+X [icon] [name]" above it.
export type GatherVfxEvent = RewardContentInfo & {
  nodeName: string;
  // Omitted when nothing was gained, e.g. the collectible that just revealed the node.
  quantity?: number;
  // Spoken line floated under the reward, e.g. a rescued worker's thanks.
  quote?: string;
};
