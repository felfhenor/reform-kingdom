import { TOWN_SPECIALTY_PRIORITY_TICK_INTERVAL } from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { updateGamestate, worldTownsState } from '@helpers/state-game';
import {
  isRecipeCraftableByTown,
  isRecipeResultAtOrAboveThreshold,
} from '@helpers/town/crafting/town-craft-eligibility';
import { updateTownNode } from '@helpers/town/town-node';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type {
  GameState,
  RecipeContent,
  RecipeId,
  TownContent,
  TownId,
  TownNodeState,
  TownSpecialtyPriorityEntry,
} from '@interfaces';

export function townSpecialtyPriority(
  townId: TownId,
): TownSpecialtyPriorityEntry[] {
  return worldTownsState()[townId]?.specialtyPriority ?? [];
}

// "Specialty" = uniqueRecipeIds only, not the whole specialty tradeskill - the latter is a large ordinary recipe pool that would perpetually fail.
function specialtyRecipesForTown(town: TownContent): RecipeContent[] {
  return town.crafting.uniqueRecipeIds
    .map((recipeId) => getEntry<RecipeContent>(recipeId))
    .filter((recipe): recipe is RecipeContent => !!recipe);
}

// A recipe already queued or sitting in stock is on its way to the player regardless - it shouldn't keep escalating.
function isBeingCraftedOrForSale(
  target: TownNodeState,
  recipe: RecipeContent,
): boolean {
  const inQueue = target.craftQueue.some(
    (entry) => entry.recipeId === recipe.id,
  );
  if (inQueue) return true;

  return (
    'equipmentId' in recipe.result &&
    target.stock.some(
      (entry) =>
        'equipmentId' in recipe.result &&
        entry.equipmentItem.equipmentId === recipe.result.equipmentId,
    )
  );
}

function upsertFailure(
  priority: TownSpecialtyPriorityEntry[],
  recipeId: RecipeId,
): TownSpecialtyPriorityEntry[] {
  const existing = priority.find((entry) => entry.recipeId === recipeId);
  if (!existing) return [...priority, { recipeId, failureCount: 1 }];

  return priority.map((entry) =>
    entry.recipeId === recipeId
      ? { ...entry, failureCount: entry.failureCount + 1 }
      : entry,
  );
}

export function resetTownSpecialtyPriority(
  state: GameState,
  townId: TownId,
  recipeId: RecipeId,
): void {
  updateTownNode(state, townId, (target) => {
    const priority = target.specialtyPriority ?? [];
    const remaining = priority.filter((entry) => entry.recipeId !== recipeId);

    if (target.specialtyPriority && remaining.length === priority.length)
      return;
    target.specialtyPriority = remaining;
  });
}

// Craftable-but-not-yet-picked is left alone - only an actual inability to craft counts as a failure.
// A capped output isn't a shortage either - more gathering can never unblock it, so it must not accumulate failures.
function evaluateSpecialtyRecipe(
  state: GameState,
  town: TownContent,
  recipe: RecipeContent,
): void {
  if (isBeingCraftedOrForSale(state.world.towns[town.id], recipe)) return;
  if (isRecipeResultAtOrAboveThreshold(recipe, town)) return;
  if (isRecipeCraftableByTown(recipe, town)) return;

  updateTownNode(state, town.id, (target) => {
    target.specialtyPriority = upsertFailure(
      target.specialtyPriority ?? [],
      recipe.id,
    );
  });
}

function processTownSpecialtyPriority(town: TownContent): void {
  updateGamestate((state) => {
    if (!state.world.towns[town.id]) return state;

    specialtyRecipesForTown(town).forEach((recipe) =>
      evaluateSpecialtyRecipe(state, town, recipe),
    );
    return state;
  });
}

export function townSpecialtyPriorityProcessTick(): void {
  getEntriesByType<TownContent>('town').forEach((town) => {
    if (
      !isTownDueForUpdate(
        town.id,
        'specialty',
        TOWN_SPECIALTY_PRIORITY_TICK_INTERVAL,
      )
    ) {
      return;
    }

    processTownSpecialtyPriority(town);
    markTownSubsystemProcessed(town.id, 'specialty');
  });
}

export function pruneInvalidTownSpecialtyPriority(
  priority: TownSpecialtyPriorityEntry[],
): TownSpecialtyPriorityEntry[] {
  return priority.filter((entry) => !!getEntry<RecipeContent>(entry.recipeId));
}
