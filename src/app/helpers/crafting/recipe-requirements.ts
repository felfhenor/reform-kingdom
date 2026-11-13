import { scaledMaterialCost } from '@helpers/item/materials';
import { globalEffectSumsState } from '@helpers/state-game';
import type { RecipeContent, RecipeRequirement } from '@interfaces';

// Towns craft from the base recipe; only the kingdom pays the material boost.
export function recipeKingdomRequirements(
  recipe: RecipeContent,
): RecipeRequirement[] {
  const boost = globalEffectSumsState().tradeskillMaterialBoost;
  if (boost === 0) return recipe.requirements;

  return recipe.requirements.map((requirement) =>
    'itemId' in requirement
      ? {
          ...requirement,
          quantity: scaledMaterialCost(requirement.quantity, boost),
        }
      : requirement,
  );
}
