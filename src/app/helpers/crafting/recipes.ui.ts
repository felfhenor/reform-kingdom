import { getEntry } from '@helpers/content/content';
import {
  applyRecipeDiscovery,
  recipeCanUnlockWithTokens,
} from '@helpers/crafting/recipes';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { applyMaterialDelta, traderTokenId } from '@helpers/item/materials';
import { updateGamestate } from '@helpers/state-game';
import type { RecipeContent, RecipeId } from '@interfaces';

// Spends tokens and discovers the recipe atomically, so both mutations land in one updateGamestate.
export async function recipeUnlockWithTokens(
  recipeId: RecipeId,
): Promise<boolean> {
  if (!recipeCanUnlockWithTokens(recipeId)) return false;

  const recipe = getEntry<RecipeContent>(recipeId);
  if (!recipe) return false;

  let unlocked = false;

  await updateGamestate((state) => {
    if (!recipeCanUnlockWithTokens(recipeId, state)) return state;

    applyMaterialDelta(state, traderTokenId(), -recipe.tokenUnlockCost);
    applyRecipeDiscovery(state, recipeId);
    unlocked = true;

    return state;
  });

  if (unlocked) {
    analyticsSendDesignEvent(
      `Progress:Museum:RecipeUnlock:${analyticsSafeSegment(recipe.name)}`,
    );
  }
  return unlocked;
}
