import { getEntriesByType } from '@helpers/content/content';
import { ledgerHas } from '@helpers/engine/ledger';
import { regionIntrosState } from '@helpers/state-game';
import type { RegionContent } from '@interfaces';

export function regionForMap(mapName: string): RegionContent | undefined {
  return getEntriesByType<RegionContent>('region').find(
    (region) => region.mapName === mapName,
  );
}

// Falls back to the raw map name for maps with no region.
export function regionNameForMap(mapName: string): string {
  return regionForMap(mapName)?.name ?? mapName;
}

export function isRegionIntroSeen(mapName: string): boolean {
  return ledgerHas(regionIntrosState(), mapName);
}

export function regionIntroPending(mapName: string): RegionContent | undefined {
  if (isRegionIntroSeen(mapName)) return undefined;

  const region = regionForMap(mapName);
  return region?.description ? region : undefined;
}
