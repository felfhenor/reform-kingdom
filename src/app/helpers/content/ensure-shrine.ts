import {
  ensureArray,
  ensureCostItem,
} from '@helpers/content/ensure-helpers-core';
import type {
  GlobalEffectId,
  ShrineContent,
  ShrineId,
  ShrineLevel,
} from '@interfaces';

export function ensureShrineLevel(
  level: Partial<ShrineLevel> = {},
): ShrineLevel {
  return {
    costs: ensureArray(level.costs, ensureCostItem),
    globalEffectId: level.globalEffectId ?? ('UNKNOWN' as GlobalEffectId),
    globalEffectDuration: level.globalEffectDuration ?? 0,
  };
}

export function ensureShrine(
  shrine: Partial<ShrineContent>,
): Required<ShrineContent> {
  return {
    id: shrine.id ?? ('UNKNOWN' as ShrineId),
    name: shrine.name ?? 'UNKNOWN',
    __type: 'shrine',
    description: shrine.description ?? 'UNKNOWN',
    hidden: shrine.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      shrine.invisibleUntilCollectibleIdsFound ?? [],
    levels: ensureArray(shrine.levels, ensureShrineLevel),
  };
}
