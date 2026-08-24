import { getEntriesByType, getEntry } from '@helpers/content';
import { partyGet } from '@helpers/hero/party';
import { getCollectibleQuantity } from '@helpers/item/collectibles';
import { equippedItems } from '@helpers/item/equipment';
import { getMaterialQuantity } from '@helpers/item/materials';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CollectibleContent,
  EncounterContent,
  EquipmentContent,
  EquipmentId,
  GameStateDiscoveredRecipes,
  ItemContent,
  RecipeContent,
  RecipeId,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

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

// Armory-stored plus currently-equipped (across the whole party) copies of
// a piece of equipment - the two are mutually exclusive in game state, so
// this is a plain sum, never a double count.
function ownedEquipmentQuantity(equipmentId: EquipmentId): number {
  const stored = getArmoryEntries().filter(
    (entry) => entry.content.id === equipmentId,
  ).length;
  const equipped = sumBy(
    partyGet(),
    (character) =>
      equippedItems(character.equipment).filter(
        (item) => item.equipmentId === equipmentId,
      ).length,
  );

  return stored + equipped;
}

// How many of a recipe's result the party currently has - inventory
// quantity for items/collectibles, or armory-stored plus currently-equipped
// count for equipment. Shown as the "Have" badge in the crafting screen.
export function recipeResultOwnedQuantity(recipe: RecipeContent): number {
  if ('itemId' in recipe.result) {
    return getMaterialQuantity(recipe.result.itemId);
  }

  if ('equipmentId' in recipe.result) {
    return ownedEquipmentQuantity(recipe.result.equipmentId);
  }

  return getCollectibleQuantity(recipe.result.collectibleId);
}

const RECIPE_BACKDROP_ITEM_NAME = 'Recipe Backdrop';

// A recipe's icon is composited from two sprites - this backdrop (from the
// "item" atlas) rendered behind whatever the recipe crafts.
export function recipeBackdropSprite(): string | undefined {
  return getEntry<ItemContent>(RECIPE_BACKDROP_ITEM_NAME)?.sprite;
}
