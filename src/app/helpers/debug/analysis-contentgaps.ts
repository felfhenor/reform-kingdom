/**
 * Reports gaps in equipment-type coverage across the level range the game
 * actually spans.
 */

import { getEntriesByType } from '@helpers/content/content';
import {
  formatWindows,
  gapWindows,
  resolveMaxContentLevel,
} from '@helpers/debug/analysis-utils';
import type {
  AnalysisCheck,
  AnalysisParams,
  AnalysisRunResult,
  EquipmentContent,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

const ALL_EQUIPMENT_TYPES = [
  'Accessory',
  'Arrow',
  'Artifact',
  'Bow',
  'Charm',
  'Cloth Armor',
  'Dagger',
  'Dirk',
  'Hat',
  'Helm',
  'Mace',
  'Metal Armor',
  'Ring',
  'Shield',
  'Spear',
  'Staff',
  'Sword',
  'Trinket',
  'Whip',
];

function equipmentTypeChecks(
  equipment: EquipmentContent[],
  maxContentLevel: number,
  gapSize: number,
  expanded: boolean,
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];
  const equipmentByType = new Map<string, EquipmentContent[]>();
  equipment
    .filter((e) => !e.unobtainable)
    .forEach((e) => {
      const list = equipmentByType.get(e.type) ?? [];
      list.push(e);
      equipmentByType.set(e.type, list);
    });

  ALL_EQUIPMENT_TYPES.forEach((type) => {
    const entries = equipmentByType.get(type) ?? [];
    const levels = entries.map((e) => e.levelRequirement);

    if (entries.length === 0) {
      checks.push({
        id: `equipment-type:${type}`,
        label: `Equipment type: ${type}`,
        status: 'warning',
        message: `Equipment type "${type}" has no obtainable items at all.`,
      });
      return;
    }

    const windows = gapWindows(levels, maxContentLevel, gapSize);
    checks.push(
      windows.length > 0
        ? {
            id: `equipment-type:${type}`,
            label: `Equipment type: ${type}`,
            status: 'warning',
            message: `Equipment type "${type}" has no item introduced at level window(s): ${formatWindows(windows)} (checked 1..${maxContentLevel}, ${entries.length} item(s) total).`,
          }
        : {
            id: `equipment-type:${type}`,
            label: `Equipment type: ${type}`,
            status: 'pass',
            message: `${type}: levels 1..${maxContentLevel} all have at least one item (${entries.length} item(s) total).`,
          },
    );

    if (expanded) {
      sortBy(entries, [(e: EquipmentContent) => e.levelRequirement]).forEach(
        (e) =>
          checks.push({
            id: `equipment-type:${type}:${e.id}`,
            label: e.name,
            status: 'info',
            message: `Lv${e.levelRequirement}: ${e.name} [${e.rarity}]`,
          }),
      );
    }
  });

  return checks;
}

export function runContentGapsAnalysis(
  params: AnalysisParams,
): AnalysisRunResult {
  const gapSize = Number(params['gap'] ?? 4);
  const expanded = !!params['expanded'];

  if (!Number.isInteger(gapSize) || gapSize < 1) {
    throw new Error(`"gap" must be a positive integer, got ${params['gap']}.`);
  }

  const checks = equipmentTypeChecks(
    getEntriesByType<EquipmentContent>('equipment'),
    resolveMaxContentLevel(params),
    gapSize,
    expanded,
  );
  const warnings = checks.filter((c) => c.status === 'warning').length;

  return {
    checks,
    summary:
      warnings === 0
        ? 'No content gaps found.'
        : `${warnings} content gap warning(s) found.`,
  };
}
