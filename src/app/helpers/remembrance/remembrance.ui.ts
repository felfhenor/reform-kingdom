import { exchangeEdictRewardCollectibleIds } from '@helpers/exchange/exchange';
import { isFelDefeated } from '@helpers/lore/outro';
import { remembranceCategories } from '@helpers/remembrance/remembrance';
import type {
  CollectibleId,
  RemembranceCategory,
  RemembranceRow,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Floored so a nearly-done category never reads 100% before it is.
export function remembranceRow(category: RemembranceCategory): RemembranceRow {
  const isComplete = category.current >= category.max;
  return {
    ...category,
    isComplete,
    percent: isComplete
      ? 100
      : Math.floor((category.current / category.max) * 100),
  };
}

// Only worth saying once Remembrance is unlocked.
export function remembranceShowsCollectibleExcluded(
  collectibleId: CollectibleId,
): boolean {
  return (
    isFelDefeated() && exchangeEdictRewardCollectibleIds().has(collectibleId)
  );
}

export function remembranceRows(): RemembranceRow[] {
  return remembranceCategories().map(remembranceRow);
}

export function remembranceOverall(rows: RemembranceRow[]): RemembranceRow {
  return remembranceRow({
    name: 'Overall',
    current: sumBy(rows, (row) => row.current),
    max: sumBy(rows, (row) => row.max),
  });
}
