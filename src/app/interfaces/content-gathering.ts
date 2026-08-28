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

  // Node development level this result is restricted to; omitted means always available.
  levelRequirement?: number;
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

    // Gates whether a worker (see content-worker.ts) gains XP gathering here.
    workerLevelRange: LevelRange;

    // Tier count for gold-funded leveling (see world-node-level.ts) - never factored into
    // levelRange/workerLevelRange eligibility checks.
    maxLevel: number;

    // Gold cost to level up from level N to N+1 is levelCostScalar * (N+1).
    levelCostScalar: number;
  };
