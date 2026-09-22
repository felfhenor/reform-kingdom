import { townMaterialAtOrAboveThreshold } from '@helpers/town/town-resource-thresholds';
import { townMaterialQuantity } from '@helpers/town/town-materials';
import type {
  RecipeContent,
  RecipeRequirement,
  RecipeRequirementItem,
  TownContent,
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
  return (
    townMaterialQuantity(townId, requirement.itemId) >= requirement.quantity
  );
}

// Exported so callers (e.g. specialty-priority failure tracking) can tell "output capped" apart from "missing ingredients" -
// only the latter is a real shortage that more gathering can fix.
export function isRecipeResultAtOrAboveThreshold(
  recipe: RecipeContent,
  town: TownContent,
): boolean {
  return (
    'itemId' in recipe.result &&
    townMaterialAtOrAboveThreshold(town, recipe.result.itemId)
  );
}

export function isRecipeCraftableByTown(
  recipe: RecipeContent,
  town: TownContent,
): boolean {
  if (town.crafting.bannedRecipeIds.includes(recipe.id)) return false;

  // TownStockEntry has no collectible variant to sell one as.
  if ('collectibleId' in recipe.result) return false;

  // Don't craft a material past its authored cap - mirrors the gather/commission threshold check.
  if (isRecipeResultAtOrAboveThreshold(recipe, town)) return false;

  return recipe.requirements.every((requirement) =>
    townHasRequirement(town.id, requirement),
  );
}
