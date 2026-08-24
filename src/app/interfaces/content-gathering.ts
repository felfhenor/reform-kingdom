import type { ItemId } from '@interfaces/content-item';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription, HasMapNodeGating } from '@interfaces/traits';

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
  HasMapNodeGating & {
    id: GatheringId;
    __type: 'gathering';

    levelRange: LevelRange;

    xpGainedIfInLevelRange: number;
    gatherTime: number;

    gatherResults: GatherResult[];

    // Rolled once, ever, per physical node - see
    // world-node-first-time-rewards.ts. Absent/empty means no first-time
    // reward. RP-only by convention (every entry must be a DroppedItemReward
    // pointing at the Insight Crystal item id), enforced by the
    // researchrpgaps validator.
    firstTimeRewards?: DroppedReward[];
  };
