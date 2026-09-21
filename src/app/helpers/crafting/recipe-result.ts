import type { RecipeContent } from '@interfaces';

export function recipeResultQuantity(recipe: RecipeContent): number {
  return 'itemId' in recipe.result ? (recipe.result.quantity ?? 1) : 1;
}
