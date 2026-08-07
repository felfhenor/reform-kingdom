import { getEntriesByType, getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CollectibleContent,
  EncounterContent,
  EquipmentContent,
  GameStateDiscoveredRecipes,
  ItemContent,
  RecipeContent,
  RecipeId,
} from '@interfaces';

// Whether this recipe has ever been found as a world drop - recipes that are
// only ever learned by leveling a tradeskill building are never discovered
// this way (see `getMuseumRecipeEntries`).
export function isRecipeDiscovered(recipeId: RecipeId): boolean {
  return !!gamestate().discoveredRecipes[recipeId]?.foundAt;
}

// Whether this recipe is gated behind a world drop - i.e. it appears as a
// `recipeId` completion reward somewhere. Drop-gated recipes should never be
// craftable until discovered, even once the tradeskill level gate is met.
export function isRecipeDropGated(recipeId: RecipeId): boolean {
  return getEntriesByType<EncounterContent>('encounter').some((encounter) =>
    encounter.completionRewards.some(
      (reward) => 'recipeId' in reward && reward.recipeId === recipeId,
    ),
  );
}

// A drop-gated recipe can only be crafted once found; every other recipe is
// available as soon as the tradeskill level gate is met.
export function isRecipeCraftable(recipeId: RecipeId): boolean {
  if (isRecipeDiscovered(recipeId)) return true;
  return !isRecipeDropGated(recipeId);
}

export function getRecipeFoundAtNode(recipeId: RecipeId): string | undefined {
  return gamestate().discoveredRecipes[recipeId]?.foundAtNode;
}

export function recipeDiscover(recipeId: RecipeId, foundAtNode?: string): void {
  updateGamestate((state) => {
    const existing = state.discoveredRecipes[recipeId];
    state.discoveredRecipes[recipeId] = {
      foundAt: existing?.foundAt ?? Date.now(),
      foundAtNode: existing?.foundAtNode ?? foundAtNode,
    };
    return state;
  });
}

// Drops any discovery entries whose recipeId no longer resolves to real
// content - e.g. after a recipe is renamed/removed from gamedata.
export function pruneInvalidDiscoveredRecipes(
  discovered: GameStateDiscoveredRecipes,
): GameStateDiscoveredRecipes {
  const pruned: GameStateDiscoveredRecipes = {};

  (Object.keys(discovered) as RecipeId[]).forEach((recipeId) => {
    if (getEntry<RecipeContent>(recipeId)) {
      pruned[recipeId] = discovered[recipeId];
    }
  });

  return pruned;
}

// The kind of content a recipe crafts - used to pick the right spritesheet
// for the recipe's icon, since a recipe has no sprite of its own (it's
// rendered as its result's sprite over the "Recipe Backdrop" item).
export function recipeResultSpritesheet(
  recipe: RecipeContent,
): 'item' | 'equipment' | 'collectible' {
  if ('itemId' in recipe.result) return 'item';
  if ('equipmentId' in recipe.result) return 'equipment';
  return 'collectible';
}

export function recipeResultContent(
  recipe: RecipeContent,
): ItemContent | EquipmentContent | CollectibleContent | undefined {
  if ('itemId' in recipe.result) {
    return getEntry<ItemContent>(recipe.result.itemId);
  }

  if ('equipmentId' in recipe.result) {
    return getEntry<EquipmentContent>(recipe.result.equipmentId);
  }

  return getEntry<CollectibleContent>(recipe.result.collectibleId);
}

const RECIPE_BACKDROP_ITEM_NAME = 'Recipe Backdrop';

// A recipe's icon is composited from two sprites - this backdrop (from the
// "item" atlas) rendered behind whatever the recipe crafts.
export function recipeBackdropSprite(): string | undefined {
  return getEntry<ItemContent>(RECIPE_BACKDROP_ITEM_NAME)?.sprite;
}
