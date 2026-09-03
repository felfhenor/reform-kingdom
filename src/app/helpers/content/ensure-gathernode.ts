import { ensureArray } from '@helpers/content/ensure-helpers-core';
import type {
  GatheringContent,
  GatheringId,
  GatherResult,
  GatherResultItem,
  ItemId,
} from '@interfaces';

function ensureGatherResultItem(
  item: Partial<GatherResultItem> = {},
): GatherResultItem {
  return {
    itemId: item.itemId ?? ('UNKNOWN' as ItemId),
    quantity: item.quantity ?? 1,
  };
}

function ensureGatherResult(result: Partial<GatherResult> = {}): GatherResult {
  return {
    chance: result.chance ?? 0,
    items: ensureArray(result.items, ensureGatherResultItem),
    levelRequirement: result.levelRequirement,
    tradeskillIds: result.tradeskillIds ?? [],
  };
}

export function ensureGathering(
  gathering: Partial<GatheringContent>,
): Required<GatheringContent> {
  return {
    id: gathering.id ?? ('UNKNOWN' as GatheringId),
    name: gathering.name ?? 'UNKNOWN',
    __type: 'gathering',
    description: gathering.description ?? 'UNKNOWN',
    levelRange: gathering.levelRange ?? { min: 1, max: 1 },
    xpGainedIfInLevelRange: gathering.xpGainedIfInLevelRange ?? 0,
    gatherTime: gathering.gatherTime ?? 1,
    gatherResults: ensureArray(gathering.gatherResults, ensureGatherResult),
    hidden: gathering.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      gathering.invisibleUntilCollectibleIdsFound ?? [],
    workerLevelRange: gathering.workerLevelRange ?? { min: 1, max: 99 },
    maxLevel: gathering.maxLevel ?? 1,
    levelCostScalar: gathering.levelCostScalar ?? 0,
  };
}
