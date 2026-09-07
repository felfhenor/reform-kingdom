import { getEntry } from '@helpers/content/content';
import { craftQueueTicksRemaining } from '@helpers/crafting/crafting';
import {
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import {
  tradeskillBuilding,
  tradeskillIdForName,
} from '@helpers/crafting/tradeskill';
import { ALL_TRADESKILLS } from '@interfaces';
import type {
  CraftingStatusEntry,
  RecipeContent,
  Tradeskill,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Denominator for the queue progress bar.
export function craftQueueTotalTicks(tradeskill: Tradeskill): number {
  return sumBy(tradeskillBuilding(tradeskill).queue, (entry) => {
    const recipe = getEntry<RecipeContent>(entry.recipeId);
    if (!recipe) return 0;

    return recipe.craftTime * entry.quantityTotal;
  });
}

// Not queue.length - a single slot can be crafting many units of one item.
export function craftQueueUnitsRemaining(tradeskill: Tradeskill): number {
  return sumBy(
    tradeskillBuilding(tradeskill).queue,
    (entry) => entry.quantityTotal - entry.quantityCompleted,
  );
}

// Recipe names are authored as "Category: Item Name" (e.g. "Material: Copper
// Ingot") - the status card only wants the item name.
function stripRecipeCategory(name: string): string {
  return name.replace(/^[^:]*:\s*/, '');
}

// One entry per tradeskill currently crafting - built for the corner status
// indicator, so an idle discipline is simply omitted rather than shown empty.
export function craftingActiveStatusEntries(): CraftingStatusEntry[] {
  return ALL_TRADESKILLS.flatMap((tradeskill) => {
    const building = tradeskillBuilding(tradeskill);
    const activeEntry = building.queue[0];
    const tradeskillId = tradeskillIdForName(tradeskill);
    if (!activeEntry || !tradeskillId) return [];

    const recipe = getEntry<RecipeContent>(activeEntry.recipeId);
    const resultContent = recipe ? recipeResultContent(recipe) : undefined;

    return [
      {
        tradeskillId,
        tradeskill,
        itemName: stripRecipeCategory(recipe?.name ?? tradeskill),
        resultSpritesheet: recipe ? recipeResultSpritesheet(recipe) : 'item',
        resultSprite: resultContent?.sprite ?? '',
        // Whole-queue remaining, not just this entry's - so players see how
        // long the discipline will be tied up, not just its current item.
        remainingTicks: craftQueueTicksRemaining(tradeskill),
      },
    ];
  });
}
