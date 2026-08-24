import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type NodeOverrideId = Branded<string, 'NodeOverrideId'>;

export type NodeOverrideContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: NodeOverrideId;
    __type: 'nodeoverride';
  };
