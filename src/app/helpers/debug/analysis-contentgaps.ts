/**
 * Reports gaps in item/equipment/infusion content across the level range the
 * game actually spans - see the original `scripts/analyze-contentgaps.ts`
 * file history for the full methodology writeup. Ported to read the already
 * -loaded compiled content (`getEntriesByType`/`getEntry`) instead of raw
 * gamedata YAML, so cross-references (`drop.itemId`, `recipe.tradeskillId`,
 * ...) are already-resolved ids rather than authored names.
 */

import { sortBy } from 'es-toolkit/compat';
import { getEntriesByType } from '@helpers/content';
import { formatWindows, gapWindows } from '@helpers/debug/analysis-utils';
import {
  buildItemSources,
  buildMonsterLevels,
  earliestLevel,
} from '@helpers/debug/analysis-item-sources';
import type {
  AnalysisCheck,
  AnalysisParams,
  AnalysisRunResult,
  CaravanContent,
  CaravanTraderContent,
  EncounterContent,
  EncounterRandomContent,
  EquipmentContent,
  GatheringContent,
  ItemContent,
  LevelRange,
  MonsterContent,
  RecipeContent,
  TradeskillContent,
} from '@interfaces';

// Keep in sync with `EquipmentItemType` in `src/app/interfaces/equipment.ts`.
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

// Keep in sync with `BaseStat` in `src/app/interfaces/stat.ts`.
const ALL_STATS = [
  'Intelligence',
  'Strength',
  'Vitality',
  'Resistance',
  'Agility',
  'Health',
  'Energy',
  'Luck',
] as const;

function isInfusionStat(item: ItemContent, stat: string): boolean {
  const value = item.infusionStats?.[stat as keyof typeof item.infusionStats];
  return typeof value === 'number' && value !== 0;
}

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

function infusionChecks(
  items: ItemContent[],
  itemSources: ReturnType<typeof buildItemSources>,
  maxContentLevel: number,
  gapSize: number,
  expanded: boolean,
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];

  ALL_STATS.forEach((stat) => {
    const statItems = items.filter((item) => isInfusionStat(item, stat));

    if (statItems.length === 0) {
      checks.push({
        id: `infusion-stat:${stat}`,
        label: `Infusion stat: ${stat}`,
        status: 'info',
        message: `No item grants ${stat} via infusion.`,
      });
      return;
    }

    const entries = statItems
      .map((item) => ({ name: item.name, level: earliestLevel(itemSources, item.id) }))
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

    const windows = gapWindows(entries.map((e) => e.level), maxContentLevel, gapSize);
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
  });

  const infusableItems = items.filter((item) =>
    ALL_STATS.some((stat) => isInfusionStat(item, stat)),
  );
  const byStatBlock = new Map<string, string[]>();
  infusableItems.forEach((item) => {
    const key = sortBy(ALL_STATS.filter((stat) => isInfusionStat(item, stat)))
      .map((stat) => `${stat}:${item.infusionStats?.[stat]}`)
      .join('|');
    const names = byStatBlock.get(key) ?? [];
    names.push(item.name);
    byStatBlock.set(key, names);
  });
  byStatBlock.forEach((names, key) => {
    if (names.length <= 1) return;
    checks.push({
      id: `infusion-duplicate:${key}`,
      label: 'Infusion duplicate',
      status: 'warning',
      message: `Items ${names.join(', ')} all grant the exact same infusion stat block (${key.split('|').join(', ')}) - one of these is a pointless duplicate.`,
    });
  });

  return checks;
}

function tradeskillChecks(
  recipes: RecipeContent[],
  tradeskills: TradeskillContent[],
  encounters: EncounterContent[],
  encounterRandoms: EncounterRandomContent[],
  expanded: boolean,
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];

  const dropGatedRecipeIds = new Set<string>();
  [...encounters, ...encounterRandoms].forEach((encounter) => {
    encounter.completionRewards.forEach((reward) => {
      if ('recipeId' in reward) dropGatedRecipeIds.add(reward.recipeId);
    });
  });

  const recipesByTradeskill = new Map<string, RecipeContent[]>();
  recipes.forEach((r) => {
    const list = recipesByTradeskill.get(r.tradeskillId) ?? [];
    list.push(r);
    recipesByTradeskill.set(r.tradeskillId, list);
  });

  const topTradeskillLevel = Math.max(0, ...recipes.map((r) => r.maxTradeskillLevel));

  tradeskills.forEach((tradeskill) => {
    const entries = recipesByTradeskill.get(tradeskill.id) ?? [];

    if (entries.length === 0) {
      checks.push({
        id: `tradeskill:${tradeskill.id}`,
        label: `Tradeskill: ${tradeskill.name}`,
        status: 'warning',
        message: `Tradeskill "${tradeskill.name}" has no recipes at all.`,
      });
      return;
    }

    const levels = entries.map((r) => r.minTradeskillLevel);
    const windows = gapWindows(levels, topTradeskillLevel, 1);
    checks.push(
      windows.length > 0
        ? {
            id: `tradeskill:${tradeskill.id}`,
            label: `Tradeskill: ${tradeskill.name}`,
            status: 'warning',
            message: `Tradeskill "${tradeskill.name}" has no new recipe introduced at level(s): ${formatWindows(windows)} (checked 1..${topTradeskillLevel}, ${entries.length} recipe(s) total).`,
          }
        : {
            id: `tradeskill:${tradeskill.id}`,
            label: `Tradeskill: ${tradeskill.name}`,
            status: 'pass',
            message: `${tradeskill.name}: levels 1..${topTradeskillLevel} each have at least one new recipe (${entries.length} recipe(s) total).`,
          },
    );

    if (expanded) {
      sortBy(entries, [(r) => r.minTradeskillLevel]).forEach((r) => {
        const gate = dropGatedRecipeIds.has(r.id) ? 'found' : 'learned';
        checks.push({
          id: `tradeskill:${tradeskill.id}:${r.id}`,
          label: r.name,
          status: 'info',
          message: `Lv${r.minTradeskillLevel}: ${r.name} [${gate}]`,
        });
      });
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

  const items = getEntriesByType<ItemContent>('item');
  const equipment = getEntriesByType<EquipmentContent>('equipment');
  const monsters = getEntriesByType<MonsterContent>('monster');
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const encounterRandoms =
    getEntriesByType<EncounterRandomContent>('encounterrandom');
  const gatherings = getEntriesByType<GatheringContent>('gathering');
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const caravans = getEntriesByType<CaravanContent>('caravan');
  const caravanTraders =
    getEntriesByType<CaravanTraderContent>('caravantrader');
  const tradeskills = getEntriesByType<TradeskillContent>('tradeskill');

  const nodeRanges: LevelRange[] = [...encounters, ...encounterRandoms, ...gatherings]
    .map((n) => n.levelRange)
    .filter(Boolean);
  const derivedMaxLevel = Math.max(0, ...nodeRanges.map((r) => r.max));
  const maxContentLevel =
    params['level'] !== undefined ? Number(params['level']) : derivedMaxLevel;

  const monsterLevels = buildMonsterLevels(encounters, encounterRandoms);
  const itemSources = buildItemSources(
    monsters,
    encounters,
    encounterRandoms,
    gatherings,
    recipes,
    caravans,
    caravanTraders,
    monsterLevels,
  );

  const checks: AnalysisCheck[] = [
    ...equipmentTypeChecks(equipment, maxContentLevel, gapSize, expanded),
    ...infusionChecks(items, itemSources, maxContentLevel, gapSize, expanded),
    ...tradeskillChecks(
      recipes,
      tradeskills,
      encounters,
      encounterRandoms,
      expanded,
    ),
  ];

  const warnings = checks.filter((c) => c.status === 'warning').length;

  return {
    checks,
    summary:
      warnings === 0
        ? 'No content gaps found.'
        : `${warnings} content gap warning(s) found.`,
  };
}
