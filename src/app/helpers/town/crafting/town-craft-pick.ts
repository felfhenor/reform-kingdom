import { SPECIALTY_RECIPE_WEIGHT } from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import { rngChoiceWeighted } from '@helpers/rng';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import {
  townItemPriorityWeightFromMap,
  townItemPriorityMap,
  townRecipeRespectsReservationsFromMap,
} from '@helpers/town/crafting/town-craft-priority-weight';
import { townSpecialtyPriority } from '@helpers/town/crafting/town-craft-priority-state';
import type {
  RecipeContent,
  TownContent,
  TownItemPriorityMap,
  TownRecipePick,
} from '@interfaces';

function recipeWeight(
  recipe: RecipeContent,
  town: TownContent,
  priorityMap: TownItemPriorityMap,
): number {
  const specialtyMultiplier =
    recipe.tradeskillId === town.crafting.specialtyTradeskillId
      ? SPECIALTY_RECIPE_WEIGHT
      : 1;

  const itemWeights = recipe.requirements
    .filter((requirement) => 'itemId' in requirement)
    .map((requirement) =>
      townItemPriorityWeightFromMap(priorityMap, requirement.itemId),
    );
  const priorityMultiplier =
    itemWeights.length === 0 ? 1 : Math.max(1, ...itemWeights);

  return specialtyMultiplier * priorityMultiplier;
}

// Weighted pick over every eligible recipe across ALL tradeskills (one shared queue, not one pick per tradeskill) - favors the town's own specialty.
export function townPickRecipeToQueue(
  town: TownContent,
): TownRecipePick | undefined {
  // Built once for every recipe scanned below, not once per recipe.
  const priorityMap = townItemPriorityMap(townSpecialtyPriority(town.id));
  const eligible = getEntriesByType<RecipeContent>('recipe').filter(
    (recipe) =>
      isRecipeCraftableByTown(recipe, town.id) &&
      townRecipeRespectsReservationsFromMap(priorityMap, town.id, recipe),
  );
  if (eligible.length === 0) return undefined;

  const recipe = rngChoiceWeighted(eligible, (r) =>
    recipeWeight(r, town, priorityMap),
  );
  if (!recipe) return undefined;

  return { tradeskillId: recipe.tradeskillId, recipe };
}
