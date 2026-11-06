import { ensureArray } from '@helpers/content/ensure-helpers-core';
import { ensureMonsterSkill } from '@helpers/content/ensure-monster';
import type { EncounterId, RegionContent, RegionId } from '@interfaces';

export function ensureRegion(
  region: Partial<RegionContent>,
): Required<RegionContent> {
  return {
    id: region.id ?? ('UNKNOWN' as RegionId),
    name: region.name ?? 'UNKNOWN',
    __type: 'region',
    description: region.description ?? '',
    mapName: region.mapName ?? 'UNKNOWN',
    seal: region.seal ?? {
      sealEncounterId: 'UNKNOWN' as EncounterId,
      parTicks: 1,
    },
    skillPool: ensureArray(region.skillPool, ensureMonsterSkill),
  };
}
