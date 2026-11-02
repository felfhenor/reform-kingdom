import { remembranceCategories } from '@helpers/remembrance/remembrance';
import type { RemembranceCategory, RemembranceRow } from '@interfaces';
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
