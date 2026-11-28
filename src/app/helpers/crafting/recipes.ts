import { t } from '@helpers/i18n/i18n';
import { contentName, contentShortName } from '@helpers/i18n/i18n-content';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { isRecipeDropGated } from '@helpers/crafting/recipe-drop-gated';
import { isRecipeTownUnique } from '@helpers/crafting/recipe-town-unique';
import {
  tradeskillBuilding,
  tradeskillNameForId,
} from '@helpers/crafting/tradeskill';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import { getCollectibleQuantity } from '@helpers/item/collectibles';
import { equippedItems } from '@helpers/item/equipment';
import { getMaterialQuantity, traderTokenId } from '@helpers/item/materials';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import {
  discoveredRecipesState,
  globalEffectSumsState,
  updateGamestate,
  worldPartyState,
} from '@helpers/state-game';
import type {
  CollectibleContent,
  EquipmentContent,
  EquipmentId,
  GameState,
  ItemContent,
  ItemId,
  RecipeContent,
  RecipeId,
  TradeskillContent,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Whether this recipe has ever been found as a world drop - recipes that are
// only ever learned by leveling a tradeskill building are never discovered
// this way.
export function isRecipeDiscovered(
  recipeId: RecipeId,
  state?: GameState,
): boolean {
  return ledgerHas(
    state ? state.discoveredRecipes : discoveredRecipesState(),
    recipeId,
  );
}

// A drop-gated recipe can only be crafted once found; every other recipe is
// available as soon as the tradeskill level gate is met.
export function isRecipeCraftable(recipeId: RecipeId): boolean {
  if (globalEffectSumsState().tradeskillsDisabled) return false;
  if (isRecipeTownUnique(recipeId)) return false;
  if (isRecipeDiscovered(recipeId)) return true;
  return !isRecipeDropGated(recipeId);
}

// Whether the player could queue it right now, ignoring materials on hand.
export function isRecipeAvailable(recipe: RecipeContent): boolean {
  const tradeskill = tradeskillNameForId(recipe.tradeskillId);
  if (!tradeskill) return false;
  if (tradeskillBuilding(tradeskill).level < recipe.minTradeskillLevel)
    return false;
  return isRecipeCraftable(recipe.id);
}

// On the tradeskill's craft list: available now, or a found recipe still above the building's level.
export function isRecipeKnown(recipe: RecipeContent): boolean {
  return (
    isRecipeAvailable(recipe) ||
    (isRecipeDiscovered(recipe.id) && isRecipeCraftable(recipe.id))
  );
}

export function recipesProducing(
  resultId: ItemId | EquipmentId,
): RecipeContent[] {
  return getEntriesByType<RecipeContent>('recipe').filter((recipe) =>
    'itemId' in recipe.result
      ? recipe.result.itemId === resultId
      : 'equipmentId' in recipe.result &&
        recipe.result.equipmentId === resultId,
  );
}

export function recipeDiscover(recipeId: RecipeId): void {
  updateGamestate((state) => {
    ledgerMark(state.discoveredRecipes, recipeId);
    return state;
  });
}

// Reverts a drop-gated recipe back to undiscovered - a debug/testing tool,
// not something normal play ever triggers.
export function recipeUndiscover(recipeId: RecipeId): void {
  updateGamestate((state) => {
    delete state.discoveredRecipes[recipeId];
    return state;
  });
}

// Only meaningful for drop-gated, undiscovered recipes - a recipe that's
// already discovered or was never drop-gated has nothing to unlock.
export function recipeCanUnlockWithTokens(
  recipeId: RecipeId,
  state?: GameState,
): boolean {
  const recipe = getEntry<RecipeContent>(recipeId);
  if (!recipe) return false;

  const tokenQuantity = state
    ? (state.materials[traderTokenId()]?.quantity ?? 0)
    : getMaterialQuantity(traderTokenId());

  return (
    !globalEffectSumsState().tradeskillsDisabled &&
    isRecipeDropGated(recipeId) &&
    !isRecipeDiscovered(recipeId, state) &&
    tokenQuantity >= recipe.tokenUnlockCost
  );
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
    worldPartyState(),
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

export function recipeStylizedName(recipe: RecipeContent): string {
  const tradeskill = getEntry<TradeskillContent>(recipe.tradeskillId);
  if (!tradeskill) return contentName(recipe);

  return t('recipe.stylizedName', {
    tradeskill: contentName(tradeskill),
    name: contentShortName(recipe),
  });
}
