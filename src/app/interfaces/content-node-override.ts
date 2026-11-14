import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasNodeBackground } from '@interfaces/node-background';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type NodeOverrideId = Branded<string, 'NodeOverrideId'>;

export type NodeOverrideContent = IsContentItem &
  HasDescription &
  WorldNodeHideable &
  HasNodeBackground & {
    id: NodeOverrideId;
    __type: 'nodeoverride';
  };
