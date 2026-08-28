import { getEntriesByType, getEntry } from '@helpers/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { partyGet } from '@helpers/hero/party';
import { getCollectibleQuantity } from '@helpers/item/collectibles';
import { equippedItems } from '@helpers/item/equipment';
import {
  applyMaterialDelta,
  getMaterialQuantity,
  traderTokenId,
} from '@helpers/item/materials';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CaravanTraderContent,
  CollectibleContent,
  EncounterContent,
  EquipmentContent,
  EquipmentId,
  GameState,
  GameStateDiscoveredRecipes,
  ItemContent,
  RecipeContent,
  RecipeId,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Whether this recipe has ever been found as a world drop - recipes that are
// only ever learned by leveling a tradeskill building are never discovered
// this way (see `getMuseumRecipeEntries`).
export function isRecipeDiscovered(
  recipeId: RecipeId,
  state: GameState = gamestate(),
): boolean {
  return !!state.discoveredRecipes[recipeId]?.foundAt;
}

// Whether this recipe is gated behind a world drop or a caravan trader sale -
// gated recipes should never be craftable until discovered.
export function isRecipeDropGated(recipeId: RecipeId): boolean {
  const droppedByEncounter = getEntriesByType<EncounterContent>(
    'encounter',
  ).some((encounter) =>
    encounter.completionRewards.some(
      (reward) => 'recipeId' in reward && reward.recipeId === recipeId,
    ),
  );
  if (droppedByEncounter) return true;

  return getEntriesByType<CaravanTraderContent>('caravantrader').some(
    (trader) =>
      trader.trades.some((trade) => trade.recipeId === recipeId) ||
      trader.tokenTrades.some((trade) => trade.recipeId === recipeId),
  );
}

// A drop-gated recipe can only be crafted once found; every other recipe is
// available as soon as the tradeskill level gate is met.
export function isRecipeCraftable(recipeId: RecipeId): boolean {
  if (isRecipeDiscovered(recipeId)) return true;
  return !isRecipeDropGated(recipeId);
}

export function recipeDiscover(recipeId: RecipeId): void {
  updateGamestate((state) => {
    const existing = state.discoveredRecipes[recipeId];
    state.discoveredRecipes[recipeId] = {
      foundAt: existing?.foundAt ?? Date.now(),
    };
    return state;
  });
}

// Reverts a drop-gated recipe back to undiscovered - a debug/testing tool
// (see debugUndiscoverRecipe), not something normal play ever triggers.
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
  state: GameState = gamestate(),
): boolean {
  const recipe = getEntry<RecipeContent>(recipeId);
  if (!recipe) return false;

  const tokenQuantity = state.materials[traderTokenId()]?.quantity ?? 0;

  return (
    isRecipeDropGated(recipeId) &&
    !isRecipeDiscovered(recipeId, state) &&
    tokenQuantity >= recipe.tokenUnlockCost
  );
}

// Spends tokens and discovers the recipe atomically - not a separate call
// into `recipeDiscover`, so both mutations land in one updateGamestate.
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
    state.discoveredRecipes[recipeId] = { foundAt: Date.now() };
    unlocked = true;

    return state;
  });

  if (unlocked) {
    analyticsSendDesignEvent(
      `Kingdom:Museum:RecipeUnlock:${analyticsSafeSegment(recipe.name)}`,
    );
  }
  return unlocked;
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
