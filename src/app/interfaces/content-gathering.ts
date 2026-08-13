import type { ItemId } from '@interfaces/content-item';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type GatheringId = Branded<string, 'GatheringId'>;

export type GatheringLevelRange = {
  min: number;
  max: number;
};

export type GatherResultItem = {
  itemId: ItemId;
  quantity: number;
};

export type GatherResult = {
  chance: number;
  items: GatherResultItem[];
};

export type GatheringContent = IsContentItem &
  HasDescription & {
    id: GatheringId;
    __type: 'gathering';

    levelRange: GatheringLevelRange;

    xpGainedIfInLevelRange: number;
    gatherTime: number;

    gatherResults: GatherResult[];

    // When true, the node's name/level label and map cursor stay hidden
    // until the player discovers it (see `world-node-discovery.ts`).
    hidden?: boolean;
  };
