import { TOWN_RECIPE_OUTPUT_DUPLICATE_CAP } from '@helpers/config';
import { worldTownsState } from '@helpers/state-game';
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

// Equipment copies come from stock, in-progress ones from the queue - a material result has no stock representation, so only the queue counts for it.
function townRecipeOutputCount(townId: TownId, recipe: RecipeContent): number {
  const state = worldTownsState()[townId];
  if (!state) return 0;

  const result = recipe.result;
  const stockCount =
    'equipmentId' in result
      ? state.stock.filter(
          (entry) => entry.equipmentItem.equipmentId === result.equipmentId,
        ).length
      : 0;
  const queueCount = state.craftQueue.filter(
    (entry) => entry.recipeId === recipe.id,
  ).length;

  return stockCount + queueCount;
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

  // Don't flood the shop and queue with the same item - let other recipes get a turn once this one has enough copies out.
  if (
    townRecipeOutputCount(town.id, recipe) >= TOWN_RECIPE_OUTPUT_DUPLICATE_CAP
  )
    return false;

  return recipe.requirements.every((requirement) =>
    townHasRequirement(town.id, requirement),
  );
}
