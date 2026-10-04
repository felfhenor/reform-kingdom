/**
 * Validates two ascending-order properties of crafting recipes: (1) a
 * craftable ingredient's earliest source must be available at or before the
 * recipe that consumes it, and
 * (2) within a tradeskill+equipment-type group, `levelRequirement` must
 * ascend with `minTradeskillLevel`.
 */

import { getEntriesByType } from '@helpers/content/content';
import {
  buildItemSources,
  buildMonsterLevels,
  earliestSource,
} from '@helpers/debug/analysis-item-sources';
import type {
  AnalysisCheck,
  AnalysisItemSource,
  AnalysisRunResult,
  CaravanContent,
  CaravanTraderContent,
  EncounterContent,
  EncounterRandomContent,
  EquipmentContent,
  EquipmentResultRecipeCheck,
  GatheringContent,
  ItemContent,
  MonsterContent,
  RecipeContent,
  TownContent,
  TradeskillContent,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

function checkRecipe(
  recipe: RecipeContent,
  craftableItemIds: Set<string>,
  itemSources: Map<string, AnalysisItemSource[]>,
  tradeskillNameById: Map<string, string>,
  itemNameById: Map<string, string>,
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];
  const recipeTradeskillName =
    tradeskillNameById.get(recipe.tradeskillId) ?? recipe.tradeskillId;

  recipe.requirements.forEach((requirement) => {
    // Non-recipe source levels are player levels, so they only lower a craftable item's earliest level.
    if (!('itemId' in requirement)) return;
    if (!craftableItemIds.has(requirement.itemId)) return;

    const earliest = earliestSource(itemSources, requirement.itemId);
    if (!earliest || earliest.level <= recipe.minTradeskillLevel) return;

    const itemName = itemNameById.get(requirement.itemId) ?? requirement.itemId;
    checks.push({
      id: `ingredient-order:${recipe.id}:${requirement.itemId}`,
      label: recipe.name,
      status: 'fail',
      message: `${recipeTradeskillName} recipe "${recipe.name}" (minTradeskillLevel ${recipe.minTradeskillLevel}) requires "${itemName}", whose earliest source is ${earliest.description} at level ${earliest.level} - an ingredient can't first become available at a higher level than the recipe that consumes it.`,
    });
  });

  return checks;
}

function checkLevelRequirementOrder(
  groupLabel: string,
  entries: EquipmentResultRecipeCheck[],
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];

  // Recipes sharing a minTradeskillLevel unlock simultaneously, so they're compared only
  // against strictly earlier tiers, never against each other.
  const tiersByLevel = new Map<number, EquipmentResultRecipeCheck[]>();
  entries.forEach((entry) => {
    const tier = tiersByLevel.get(entry.minTradeskillLevel) ?? [];
    tier.push(entry);
    tiersByLevel.set(entry.minTradeskillLevel, tier);
  });
  const levels = sortBy(Array.from(tiersByLevel.keys()), [
    (level: number) => level,
  ]);

  let highestSoFar: EquipmentResultRecipeCheck | undefined;
  levels.forEach((level) => {
    const tierEntries = tiersByLevel.get(level) as EquipmentResultRecipeCheck[];

    if (highestSoFar) {
      const knownHighest = highestSoFar;
      tierEntries.forEach((entry) => {
        if (entry.levelRequirement < knownHighest.levelRequirement) {
          checks.push({
            id: `level-order:${groupLabel}:${entry.name}`,
            label: groupLabel,
            status: 'fail',
            message: `${groupLabel}: recipe "${entry.name}" (minTradeskillLevel ${entry.minTradeskillLevel}) produces equipment with levelRequirement ${entry.levelRequirement}, lower than recipe "${knownHighest.name}" (minTradeskillLevel ${knownHighest.minTradeskillLevel}, levelRequirement ${knownHighest.levelRequirement}) - a recipe unlocked later shouldn't produce weaker gear.`,
          });
        }
      });
    }

    const tierBest = sortBy(tierEntries, [
      (entry: EquipmentResultRecipeCheck) => -entry.levelRequirement,
    ])[0];
    if (
      !highestSoFar ||
      tierBest.levelRequirement > highestSoFar.levelRequirement
    ) {
      highestSoFar = tierBest;
    }
  });

  return checks;
}

export function runRecipeIngredientOrderAnalysis(): AnalysisRunResult {
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const equipment = getEntriesByType<EquipmentContent>('equipment');
  const tradeskillNameById = new Map(
    getEntriesByType<TradeskillContent>('tradeskill').map((t) => [
      t.id,
      t.name,
    ]),
  );
  const itemNameById = new Map(
    getEntriesByType<ItemContent>('item').map((i) => [i.id, i.name]),
  );
  const equipmentById = new Map(equipment.map((e) => [e.id, e]));

  const encounters = getEntriesByType<EncounterContent>('encounter');
  const encounterRandoms =
    getEntriesByType<EncounterRandomContent>('encounterrandom');
  const itemSources = buildItemSources(
    getEntriesByType<MonsterContent>('monster'),
    encounters,
    encounterRandoms,
    getEntriesByType<GatheringContent>('gathering'),
    recipes,
    getEntriesByType<CaravanContent>('caravan'),
    getEntriesByType<CaravanTraderContent>('caravantrader'),
    buildMonsterLevels(encounters, encounterRandoms),
    getEntriesByType<TownContent>('town'),
  );
  const craftableItemIds = new Set(
    recipes.flatMap((r) => ('itemId' in r.result ? [r.result.itemId] : [])),
  );
  const checks: AnalysisCheck[] = [];

  recipes.forEach((recipe) => {
    checks.push(
      ...checkRecipe(
        recipe,
        craftableItemIds,
        itemSources,
        tradeskillNameById,
        itemNameById,
      ),
    );
  });

  const levelRequirementGroups = new Map<
    string,
    EquipmentResultRecipeCheck[]
  >();
  recipes.forEach((recipe) => {
    if (!('equipmentId' in recipe.result)) return;

    const equip = equipmentById.get(recipe.result.equipmentId);
    if (!equip) return;

    const tradeskillName =
      tradeskillNameById.get(recipe.tradeskillId) ?? recipe.tradeskillId;
    const groupLabel = `${tradeskillName} / ${equip.type}`;
    const group = levelRequirementGroups.get(groupLabel) ?? [];
    group.push({
      name: recipe.name,
      minTradeskillLevel: recipe.minTradeskillLevel,
      levelRequirement: equip.levelRequirement,
    });
    levelRequirementGroups.set(groupLabel, group);
  });

  levelRequirementGroups.forEach((entries, groupLabel) => {
    const groupChecks = checkLevelRequirementOrder(groupLabel, entries);
    if (groupChecks.length === 0) {
      checks.push({
        id: `level-order:${groupLabel}`,
        label: groupLabel,
        status: 'pass',
        message: `${groupLabel}: levelRequirement ascends with minTradeskillLevel across ${entries.length} recipe(s).`,
      });
    }
    checks.push(...groupChecks);
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? "Every recipe's item requirements are available at or below its own tradeskill level, and equipment level requirements ascend correctly."
        : `${failures} problem(s) found.`,
  };
}
