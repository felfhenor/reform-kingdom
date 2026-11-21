import { getEntriesByType } from '@helpers/content/content';
import type { RegionContent, RunSplit, RunStatsTotals } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// Fel needs no split of his own: his fight is the Astral Observatory's seal.
export function runSplits(totals?: Pick<RunStatsTotals, 'seals'>): RunSplit[] {
  if (!totals) return [];

  const seals = getEntriesByType<RegionContent>('region').flatMap((region) => {
    const tick = totals.seals?.[region.id];
    return tick === undefined
      ? []
      : [{ key: region.id, name: region.name, tick }];
  });

  return sortBy(seals, (split) => split.tick);
}
