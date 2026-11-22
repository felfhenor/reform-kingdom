import { allContentById, getEntriesByType } from '@helpers/content/content';
import type { RecipeId, TownContent } from '@interfaces';

// Keyed by the content map, so a content reload is just a cache miss.
const townUniqueCache = new WeakMap<object, Set<RecipeId>>();

function townUniqueRecipeIds(): Set<RecipeId> {
  const content = allContentById();
  const cached = townUniqueCache.get(content);
  if (cached) return cached;

  const ids = new Set(
    getEntriesByType<TownContent>('town').flatMap(
      (town) => town.crafting.uniqueRecipeIds,
    ),
  );
  townUniqueCache.set(content, ids);
  return ids;
}

// Exclusively obtainable through the town's own shop stock - never on the player's own tradeskill craft list.
export function isRecipeTownUnique(recipeId: RecipeId): boolean {
  return townUniqueRecipeIds().has(recipeId);
}
