import type { ItemId } from '@interfaces/content-item';
import type { TradeskillId } from '@interfaces/content-tradeskill';
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

  // Node development level this result is restricted to; omitted means always available.
  levelRequirement?: number;

  // Which tradeskill(s) this specific result's items feed, for gather-yield affixes.
  tradeskillIds: TradeskillId[];
};

export type GatherLevelCostItem = {
  itemId: ItemId;
  required: number;
};

export type GatherLevelCost = {
  costs: GatherLevelCostItem[];
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

    // Gates whether a worker gains XP gathering here.
    workerLevelRange: LevelRange;

    // Tier count is levelCost.length; gatherResults' levelRequirement values are authored 0..levelCost.length-1.
    levelCost: GatherLevelCost[];
  };
