import { getEntriesByType, getEntry } from '@helpers/content/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type {
  RecipeContent,
  RecipeId,
  TownContent,
  TownId,
  TownNodeState,
  TownSpecialtyPriorityEntry,
} from '@interfaces';

const TOWN_SPECIALTY_PRIORITY_TICK_INTERVAL = 1;

export function townSpecialtyPriority(
  townId: TownId,
): TownSpecialtyPriorityEntry[] {
  return gamestate().world.towns[townId]?.specialtyPriority ?? [];
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
  target: TownNodeState,
  recipeId: RecipeId,
): void {
  target.specialtyPriority = (target.specialtyPriority ?? []).filter(
    (entry) => entry.recipeId !== recipeId,
  );
}

// Craftable-but-not-yet-picked is left alone - only an actual inability to craft counts as a failure.
function evaluateSpecialtyRecipe(
  target: TownNodeState,
  townId: TownId,
  recipe: RecipeContent,
): void {
  if (isBeingCraftedOrForSale(target, recipe)) return;
  if (isRecipeCraftableByTown(recipe, townId)) return;

  target.specialtyPriority = upsertFailure(
    target.specialtyPriority ?? [],
    recipe.id,
  );
}

function processTownSpecialtyPriority(town: TownContent): void {
  updateGamestate((state) => {
    const target = state.world.towns[town.id];
    if (!target) return state;

    specialtyRecipesForTown(town).forEach((recipe) =>
      evaluateSpecialtyRecipe(target, town.id, recipe),
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
