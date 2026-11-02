import {
  remembranceBestiary,
  remembranceCollectibles,
  remembranceDevelopment,
  remembranceEquipment,
  remembranceMaterials,
  remembranceTasks,
  remembranceWorkers,
} from '@helpers/remembrance/remembrance';
import type { RemembranceCategory, RemembranceRow } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Floored so a nearly-done category never reads 100% before it is.
function remembranceRow(category: RemembranceCategory): RemembranceRow {
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
  return [
    remembranceCollectibles(),
    remembranceMaterials(),
    remembranceEquipment(),
    remembranceBestiary(),
    remembranceWorkers(),
    remembranceDevelopment('shrine'),
    remembranceDevelopment('outpost'),
    remembranceDevelopment('gathering'),
    remembranceTasks(),
  ].map(remembranceRow);
}

export function remembranceOverall(rows: RemembranceRow[]): RemembranceRow {
  return remembranceRow({
    name: 'Overall',
    current: sumBy(rows, (row) => row.current),
    max: sumBy(rows, (row) => row.max),
  });
}
