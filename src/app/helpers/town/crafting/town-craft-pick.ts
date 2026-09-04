import { getEntriesByType } from '@helpers/content/content';
import { rngChoice } from '@helpers/rng';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import type { RecipeContent, TownId, TownRecipePick } from '@interfaces';

// Uniform pick over every eligible recipe across ALL tradeskills (one shared queue, not one pick per tradeskill) - speciality weighting is a later refinement.
export function townPickRecipeToQueue(
  townId: TownId,
): TownRecipePick | undefined {
  const eligible = getEntriesByType<RecipeContent>('recipe').filter((recipe) =>
    isRecipeCraftableByTown(recipe, townId),
  );
  if (eligible.length === 0) return undefined;

  const recipe = rngChoice(eligible);
  return { tradeskillId: recipe.tradeskillId, recipe };
}
