import {
  ensureArray,
  ensureWorldNodeDevelopmentLevel,
} from '@helpers/content/ensure-helpers-core';
import type { OutpostContent, OutpostId } from '@interfaces';

export function ensureOutpost(
  outpost: Partial<OutpostContent>,
): Required<OutpostContent> {
  return {
    id: outpost.id ?? ('UNKNOWN' as OutpostId),
    name: outpost.name ?? 'UNKNOWN',
    __type: 'outpost',
    description: outpost.description ?? 'UNKNOWN',
    hidden: outpost.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      outpost.invisibleUntilCollectibleIdsFound ?? [],
    levels: ensureArray(outpost.levels, ensureWorldNodeDevelopmentLevel),
  };
}
