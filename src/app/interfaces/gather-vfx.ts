import type { RewardContentInfo } from '@interfaces/world-nodes';

// Fired whenever a resource/reward is granted at a node, so the map can pop a floating "+X [icon] [name]" above it.
export type GatherVfxEvent = RewardContentInfo & {
  nodeName: string;
  quantity: number;
};
