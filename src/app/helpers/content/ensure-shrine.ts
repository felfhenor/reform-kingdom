import {
  ensureArray,
  ensureWorldNodeDevelopmentLevel,
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
    ...ensureWorldNodeDevelopmentLevel(level),
    globalEffectId: level.globalEffectId ?? ('UNKNOWN' as GlobalEffectId),
    globalEffectDuration: level.globalEffectDuration ?? 0,
    legend: level.legend ?? '',
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
    legendName: shrine.legendName ?? 'Legend of the Shrine',
    levels: ensureArray(shrine.levels, ensureShrineLevel),
  };
}
