import {
  ensureArray,
  ensureItemQuantity,
  ensureWorldNodeDevelopmentLevel,
} from '@helpers/content/ensure-helpers-core';
import type { GatheringContent, GatheringId, GatherResult } from '@interfaces';

export function ensureGatherResult(
  result: Partial<GatherResult> = {},
): GatherResult {
  return {
    chance: result.chance ?? 0,
    items: ensureArray(result.items, ensureItemQuantity),
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
    gatherReductionPerUpgradeLevel:
      gathering.gatherReductionPerUpgradeLevel ?? 0,
    gatherResults: ensureArray(gathering.gatherResults, ensureGatherResult),
    hidden: gathering.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      gathering.invisibleUntilCollectibleIdsFound ?? [],
    workerLevelRange: gathering.workerLevelRange ?? { min: 1, max: 99 },
    levels: ensureArray(gathering.levels, ensureWorldNodeDevelopmentLevel),
  };
}
