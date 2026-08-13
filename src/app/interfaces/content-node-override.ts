import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type NodeOverrideId = Branded<string, 'NodeOverrideId'>;

export type NodeOverrideContent = IsContentItem &
  HasDescription & {
    id: NodeOverrideId;
    __type: 'nodeoverride';

    // When true, the node's name/level label and map cursor stay hidden
    // until the player discovers it (see `world-node-discovery.ts`).
    hidden?: boolean;
  };
