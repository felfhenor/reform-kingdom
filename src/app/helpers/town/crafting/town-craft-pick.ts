import { getEntriesByType } from '@helpers/content/content';
import { rngChoiceWeighted } from '@helpers/rng';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import type { RecipeContent, TownContent, TownRecipePick } from '@interfaces';

// No authored weight value exists yet - a specialty recipe is this many times as likely to be picked as a non-specialty one.
const SPECIALTY_RECIPE_WEIGHT = 3;

function recipeWeight(recipe: RecipeContent, town: TownContent): number {
  return recipe.tradeskillId === town.crafting.specialtyTradeskillId
    ? SPECIALTY_RECIPE_WEIGHT
    : 1;
}

// Weighted pick over every eligible recipe across ALL tradeskills (one shared queue, not one pick per tradeskill) - favors the town's own specialty.
export function townPickRecipeToQueue(
  town: TownContent,
): TownRecipePick | undefined {
  const eligible = getEntriesByType<RecipeContent>('recipe').filter((recipe) =>
    isRecipeCraftableByTown(recipe, town.id),
  );
  if (eligible.length === 0) return undefined;

  const recipe = rngChoiceWeighted(eligible, (r) => recipeWeight(r, town));
  if (!recipe) return undefined;

  return { tradeskillId: recipe.tradeskillId, recipe };
}
