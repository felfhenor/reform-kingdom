import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type NodeOverrideId = Branded<string, 'NodeOverrideId'>;

export type NodeOverrideContent = IsContentItem &
  HasDescription & {
    id: NodeOverrideId;
    __type: 'nodeoverride';
  };
