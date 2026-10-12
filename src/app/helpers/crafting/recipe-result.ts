import { rngSucceedsChance } from '@helpers/rng';
import type { RecipeContent } from '@interfaces';

export function recipeResultQuantity(recipe: RecipeContent): number {
  return 'itemId' in recipe.result ? (recipe.result.quantity ?? 1) : 1;
}

// A result with a `chance` can whiff entirely, producing nothing.
export function recipeResultRollSucceeds(recipe: RecipeContent): boolean {
  const { chance } = recipe.result;
  return chance === undefined || rngSucceedsChance(chance);
}
