import type { ItemId } from '@interfaces/content-item';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type GatheringId = Branded<string, 'GatheringId'>;

export type GatherResultItem = {
  itemId: ItemId;
  quantity: number;
};

export type GatherResult = {
  chance: number;
  items: GatherResultItem[];
};

export type GatheringContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: GatheringId;
    __type: 'gathering';

    levelRange: LevelRange;

    xpGainedIfInLevelRange: number;
    gatherTime: number;

    gatherResults: GatherResult[];
  };
