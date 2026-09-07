import { townMaterialQuantity } from '@helpers/town/town-materials';
import type {
  RecipeContent,
  RecipeRequirement,
  RecipeRequirementItem,
  TownId,
} from '@interfaces';

// A town has no equipment stash or collectible ownership - only item requirements are satisfiable.
function isTownSatisfiableRequirement(
  requirement: RecipeRequirement,
): requirement is RecipeRequirementItem {
  return 'itemId' in requirement;
}

function townHasRequirement(
  townId: TownId,
  requirement: RecipeRequirement,
): boolean {
  if (!isTownSatisfiableRequirement(requirement)) return false;
  return townMaterialQuantity(townId, requirement.itemId) >= requirement.quantity;
}

export function isRecipeCraftableByTown(
  recipe: RecipeContent,
  townId: TownId,
): boolean {
  // TownStockEntry has no collectible variant to sell one as.
  if ('collectibleId' in recipe.result) return false;

  return recipe.requirements.every((requirement) =>
    townHasRequirement(townId, requirement),
  );
}
