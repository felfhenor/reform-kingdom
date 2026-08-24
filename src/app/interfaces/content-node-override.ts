import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription, HasMapNodeGating } from '@interfaces/traits';

export type NodeOverrideId = Branded<string, 'NodeOverrideId'>;

export type NodeOverrideContent = IsContentItem &
  HasDescription &
  HasMapNodeGating & {
    id: NodeOverrideId;
    __type: 'nodeoverride';
  };
