/**
 * Reports gaps in infusion-material coverage, per stat, across the level range
 * the game actually spans.
 */

import { getEntriesByType } from '@helpers/content/content';
import {
  buildItemSources,
  buildMonsterLevels,
  earliestLevel,
} from '@helpers/debug/analysis-item-sources';
import {
  BASE_STATS,
  formatWindows,
  gapWindows,
  resolveMaxContentLevel,
} from '@helpers/debug/analysis-utils';
import type {
  AnalysisCheck,
  AnalysisParams,
  AnalysisRunResult,
  CaravanContent,
  CaravanTraderContent,
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  ItemContent,
  MonsterContent,
  RecipeContent,
  TownContent,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

function isInfusionStat(item: ItemContent, stat: string): boolean {
  const value = item.infusionStats?.[stat as keyof typeof item.infusionStats];
  return typeof value === 'number' && value !== 0;
}

function statChecks(
  stat: string,
  statItems: ItemContent[],
  itemSources: ReturnType<typeof buildItemSources>,
  maxContentLevel: number,
  gapSize: number,
  expanded: boolean,
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];

  const entries = statItems
    .map((item) => ({
      name: item.name,
      level: earliestLevel(itemSources, item.id),
    }))
    .filter((e): e is { name: string; level: number } => e.level !== undefined);

  const unsourced = statItems.filter(
    (item) => earliestLevel(itemSources, item.id) === undefined,
  );
  if (unsourced.length > 0) {
    checks.push({
      id: `infusion-stat:${stat}:unsourced`,
      label: `Infusion stat: ${stat}`,
      status: 'warning',
      message: `${unsourced.length} item(s) grant ${stat} but have no derived level: ${unsourced.map((i) => i.name).join(', ')}`,
    });
  }

  if (expanded) {
    sortBy(entries, [(e) => e.level]).forEach((e) =>
      checks.push({
        id: `infusion-stat:${stat}:${e.name}`,
        label: e.name,
        status: 'info',
        message: `Lv${e.level}: ${e.name}`,
      }),
    );
  }

  const windows = gapWindows(
    entries.map((e) => e.level),
    maxContentLevel,
    gapSize,
  );
  checks.push(
    windows.length > 0
      ? {
          id: `infusion-stat:${stat}:coverage`,
          label: `Infusion stat: ${stat}`,
          status: 'warning',
          message: `${stat} infusion has no item introduced at level window(s): ${formatWindows(windows)} (checked 1..${maxContentLevel}).`,
        }
      : {
          id: `infusion-stat:${stat}:coverage`,
          label: `Infusion stat: ${stat}`,
          status: 'pass',
          message: `Levels 1..${maxContentLevel} all have at least one ${stat} infusion item.`,
        },
  );

  return checks;
}

function duplicateChecks(items: ItemContent[]): AnalysisCheck[] {
  const infusableItems = items.filter((item) =>
    BASE_STATS.some((stat) => isInfusionStat(item, stat)),
  );
  const byStatBlock = new Map<string, string[]>();
  infusableItems.forEach((item) => {
    const key = sortBy(BASE_STATS.filter((stat) => isInfusionStat(item, stat)))
      .map((stat) => `${stat}:${item.infusionStats?.[stat]}`)
      .join('|');
    const names = byStatBlock.get(key) ?? [];
    names.push(item.name);
    byStatBlock.set(key, names);
  });

  return [...byStatBlock.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([key, names]): AnalysisCheck => ({
      id: `infusion-duplicate:${key}`,
      label: 'Infusion duplicate',
      status: 'warning',
      message: `Items ${names.join(', ')} all grant the exact same infusion stat block (${key.split('|').join(', ')}) - one of these is a pointless duplicate.`,
    }));
}

function infusionChecks(
  items: ItemContent[],
  itemSources: ReturnType<typeof buildItemSources>,
  maxContentLevel: number,
  gapSize: number,
  expanded: boolean,
): AnalysisCheck[] {
  const perStat = BASE_STATS.flatMap((stat): AnalysisCheck[] => {
    const statItems = items.filter((item) => isInfusionStat(item, stat));

    if (statItems.length === 0) {
      return [
        {
          id: `infusion-stat:${stat}`,
          label: `Infusion stat: ${stat}`,
          status: 'info',
          message: `No item grants ${stat} via infusion.`,
        },
      ];
    }

    return statChecks(
      stat,
      statItems,
      itemSources,
      maxContentLevel,
      gapSize,
      expanded,
    );
  });

  return [...perStat, ...duplicateChecks(items)];
}

export function runInfusionGapsAnalysis(
  params: AnalysisParams,
): AnalysisRunResult {
  const gapSize = Number(params['gap'] ?? 4);
  const expanded = !!params['expanded'];

  if (!Number.isInteger(gapSize) || gapSize < 1) {
    throw new Error(`"gap" must be a positive integer, got ${params['gap']}.`);
  }

  const encounters = getEntriesByType<EncounterContent>('encounter');
  const encounterRandoms =
    getEntriesByType<EncounterRandomContent>('encounterrandom');

  const itemSources = buildItemSources(
    getEntriesByType<MonsterContent>('monster'),
    encounters,
    encounterRandoms,
    getEntriesByType<GatheringContent>('gathering'),
    getEntriesByType<RecipeContent>('recipe'),
    getEntriesByType<CaravanContent>('caravan'),
    getEntriesByType<CaravanTraderContent>('caravantrader'),
    buildMonsterLevels(encounters, encounterRandoms),
    getEntriesByType<TownContent>('town'),
  );

  const checks = infusionChecks(
    getEntriesByType<ItemContent>('item'),
    itemSources,
    resolveMaxContentLevel(params),
    gapSize,
    expanded,
  );
  const warnings = checks.filter((c) => c.status === 'warning').length;

  return {
    checks,
    summary:
      warnings === 0
        ? 'No infusion gaps found.'
        : `${warnings} infusion gap warning(s) found.`,
  };
}
