import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type CollectibleId = Branded<string, 'CollectibleId'>;

export type CollectibleContent = IsContentItem &
  HasDescription & {
    id: CollectibleId;
  };
