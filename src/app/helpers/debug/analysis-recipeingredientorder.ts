/**
 * Validates two ascending-order properties of crafting recipes: (1) an
 * ingredient recipe must unlock at or before the recipe that consumes it,
 * and (2) within a tradeskill+equipment-type group, `levelRequirement` must
 * ascend with `minTradeskillLevel`. Ported from
 * `scripts/validate-recipeingredientorder.ts`.
 */

import { sortBy } from 'es-toolkit/compat';
import { getEntriesByType } from '@helpers/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EquipmentContent,
  EquipmentResultRecipeCheck,
  RecipeContent,
  RecipeItemProducer,
  TradeskillContent,
} from '@interfaces';

function buildItemProducerIndex(
  recipes: RecipeContent[],
): Map<string, RecipeItemProducer[]> {
  const index = new Map<string, RecipeItemProducer[]>();

  recipes.forEach((recipe) => {
    if (!('itemId' in recipe.result)) return;

    const producers = index.get(recipe.result.itemId) ?? [];
    producers.push({
      name: recipe.name,
      tradeskillId: recipe.tradeskillId,
      minTradeskillLevel: recipe.minTradeskillLevel,
    });
    index.set(recipe.result.itemId, producers);
  });

  return index;
}

function checkRecipe(
  recipe: RecipeContent,
  itemProducers: Map<string, RecipeItemProducer[]>,
  tradeskillNameById: Map<string, string>,
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];
  const recipeTradeskillName = tradeskillNameById.get(recipe.tradeskillId) ?? recipe.tradeskillId;

  recipe.requirements.forEach((requirement) => {
    if (!('itemId' in requirement)) return;

    const producers = itemProducers.get(requirement.itemId) ?? [];
    producers.forEach((producer) => {
      if (producer.minTradeskillLevel <= recipe.minTradeskillLevel) return;

      const producerTradeskillName = tradeskillNameById.get(producer.tradeskillId) ?? producer.tradeskillId;
      checks.push({
        id: `ingredient-order:${recipe.id}:${producer.name}`,
        label: recipe.name,
        status: 'fail',
        message: `${recipeTradeskillName} recipe "${recipe.name}" (minTradeskillLevel ${recipe.minTradeskillLevel}) requires an item only craftable via ${producerTradeskillName} recipe "${producer.name}" at minTradeskillLevel ${producer.minTradeskillLevel} - an ingredient recipe can't require a higher tradeskill level than the recipe that consumes it.`,
      });
    });
  });

  return checks;
}

function checkLevelRequirementOrder(
  groupLabel: string,
  entries: EquipmentResultRecipeCheck[],
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];
  const sorted = sortBy(entries, [
    (entry: EquipmentResultRecipeCheck) => entry.minTradeskillLevel,
  ]);

  let highestSoFar = sorted[0];
  sorted.slice(1).forEach((entry) => {
    if (entry.levelRequirement < highestSoFar.levelRequirement) {
      checks.push({
        id: `level-order:${groupLabel}:${entry.name}`,
        label: groupLabel,
        status: 'fail',
        message: `${groupLabel}: recipe "${entry.name}" (minTradeskillLevel ${entry.minTradeskillLevel}) produces equipment with levelRequirement ${entry.levelRequirement}, lower than recipe "${highestSoFar.name}" (minTradeskillLevel ${highestSoFar.minTradeskillLevel}, levelRequirement ${highestSoFar.levelRequirement}) - a recipe unlocked later shouldn't produce weaker gear.`,
      });
      return;
    }

    if (entry.levelRequirement > highestSoFar.levelRequirement) {
      highestSoFar = entry;
    }
  });

  return checks;
}

export function runRecipeIngredientOrderAnalysis(): AnalysisRunResult {
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const equipment = getEntriesByType<EquipmentContent>('equipment');
  const tradeskillNameById = new Map(
    getEntriesByType<TradeskillContent>('tradeskill').map((t) => [t.id, t.name]),
  );
  const equipmentById = new Map(equipment.map((e) => [e.id, e]));

  const itemProducers = buildItemProducerIndex(recipes);
  const checks: AnalysisCheck[] = [];

  recipes.forEach((recipe) => {
    checks.push(...checkRecipe(recipe, itemProducers, tradeskillNameById));
  });

  const levelRequirementGroups = new Map<string, EquipmentResultRecipeCheck[]>();
  recipes.forEach((recipe) => {
    if (!('equipmentId' in recipe.result)) return;

    const equip = equipmentById.get(recipe.result.equipmentId);
    if (!equip) return;

    const tradeskillName = tradeskillNameById.get(recipe.tradeskillId) ?? recipe.tradeskillId;
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
        ? "Every recipe's item requirements are craftable at or below its own tradeskill level, and equipment level requirements ascend correctly."
        : `${failures} problem(s) found.`,
  };
}
