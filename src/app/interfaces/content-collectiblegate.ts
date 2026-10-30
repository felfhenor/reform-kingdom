import type { CollectibleId } from '@interfaces/content-collectible';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type CollectibleGateId = Branded<string, 'CollectibleGateId'>;

export type CollectibleGateContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: CollectibleGateId;
    __type: 'collectiblegate';

    // Impassable until every listed collectible has been found.
    requiredCollectibleIds: CollectibleId[];
  };
