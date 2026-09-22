import {
  TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT,
  TOWN_PRIORITY_WEIGHT_PER_FAILURE,
  TOWN_SPECIALTY_COMMISSION_WEIGHT_PER_FAILURE,
  TOWN_SPECIALTY_FAILURE_HOLD_THRESHOLD,
  TOWN_SPECIALTY_FAILURE_HOLD_WEIGHT_PENALTY,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { townMaterialQuantity } from '@helpers/town/town-materials';
import type {
  CommissionOfferContent,
  ItemId,
  RecipeContent,
  RecipeId,
  TownContent,
  TownItemPriorityMap,
  TownSpecialtyPriorityEntry,
} from '@interfaces';

function priorityMultiplier(
  failureCount: number,
  weightPerFailure: number,
  cap = TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT,
): number {
  const cappedFailures = Math.min(failureCount, cap);
  return 1 + weightPerFailure * cappedFailures;
}

function activeEntries(
  priority: TownSpecialtyPriorityEntry[],
): TownSpecialtyPriorityEntry[] {
  return priority.filter((entry) => entry.failureCount > 0);
}

// One pass over the (small) priority list - callers scanning many items must build this once, not per item.
export function townItemPriorityMap(
  priority: TownSpecialtyPriorityEntry[],
): TownItemPriorityMap {
  const weightByItem: Partial<Record<ItemId, number>> = {};
  const reservedByItem: Partial<
    Record<
      ItemId,
      { total: number; byRecipe: Partial<Record<RecipeId, number>> }
    >
  > = {};
  const heldByItem: Partial<Record<ItemId, RecipeId[]>> = {};

  activeEntries(priority).forEach((entry) => {
    const recipe = getEntry<RecipeContent>(entry.recipeId);
    if (!recipe) return;

    const weight = priorityMultiplier(
      entry.failureCount,
      TOWN_PRIORITY_WEIGHT_PER_FAILURE,
    );
    const isHeld = entry.failureCount > TOWN_SPECIALTY_FAILURE_HOLD_THRESHOLD;

    recipe.requirements.forEach((requirement) => {
      if (!('itemId' in requirement)) return;

      weightByItem[requirement.itemId] = Math.max(
        weightByItem[requirement.itemId] ?? 1,
        weight,
      );

      const bucket = (reservedByItem[requirement.itemId] ??= {
        total: 0,
        byRecipe: {},
      });
      bucket.total += requirement.quantity;
      bucket.byRecipe[recipe.id] =
        (bucket.byRecipe[recipe.id] ?? 0) + requirement.quantity;

      if (isHeld) {
        (heldByItem[requirement.itemId] ??= []).push(recipe.id);
      }
    });
  });

  return { weightByItem, reservedByItem, heldByItem };
}

export function townItemPriorityWeightFromMap(
  map: TownItemPriorityMap,
  itemId: ItemId,
): number {
  return map.weightByItem[itemId] ?? 1;
}

// Convenience for a single lookup - builds the map fresh each call, so a scan over many items should build it once instead.
export function townItemPriorityWeight(
  priority: TownSpecialtyPriorityEntry[],
  itemId: ItemId,
): number {
  return townItemPriorityWeightFromMap(townItemPriorityMap(priority), itemId);
}

export function townReservedMaterialQuantityFromMap(
  map: TownItemPriorityMap,
  itemId: ItemId,
  excludingRecipeId?: RecipeId,
): number {
  const bucket = map.reservedByItem[itemId];
  if (!bucket) return 0;

  const excluded = excludingRecipeId
    ? (bucket.byRecipe[excludingRecipeId] ?? 0)
    : 0;
  return bucket.total - excluded;
}

export function townReservedMaterialQuantity(
  priority: TownSpecialtyPriorityEntry[],
  itemId: ItemId,
  excludingRecipeId?: RecipeId,
): number {
  return townReservedMaterialQuantityFromMap(
    townItemPriorityMap(priority),
    itemId,
    excludingRecipeId,
  );
}

// Blocks other recipes from spending a struggling specialty recipe's reserved materials, not the recipe itself.
// Specialty recipes are exempt outright - excluding only self still counts every other active specialty entry as
// reserved, so several sharing one material would otherwise deadlock each other needing the full combined pool.
export function townRecipeRespectsReservationsFromMap(
  map: TownItemPriorityMap,
  town: TownContent,
  recipe: RecipeContent,
): boolean {
  // Own active entry (not just current uniqueRecipeIds) exempts too - a recipe dropped from the list mid-save must still never deadlock on itself.
  const isSpecialty =
    town.crafting.uniqueRecipeIds.includes(recipe.id) ||
    recipe.requirements.some(
      (requirement) =>
        'itemId' in requirement &&
        map.reservedByItem[requirement.itemId]?.byRecipe[recipe.id] !==
          undefined,
    );
  if (isSpecialty) return true;

  return recipe.requirements.every((requirement) => {
    if (!('itemId' in requirement)) return true;

    const reserved = townReservedMaterialQuantityFromMap(
      map,
      requirement.itemId,
      recipe.id,
    );
    if (reserved <= 0) return true;

    const have = townMaterialQuantity(town.id, requirement.itemId);
    return have - requirement.quantity >= reserved;
  });
}

export function townRecipeRespectsReservations(
  priority: TownSpecialtyPriorityEntry[],
  town: TownContent,
  recipe: RecipeContent,
): boolean {
  return townRecipeRespectsReservationsFromMap(
    townItemPriorityMap(priority),
    town,
    recipe,
  );
}

// Specialty recipes are always full weight; a deprioritized (not blocked) recipe can still occasionally win the pick.
// Held-by is keyed to the holding entry, not current uniqueRecipeIds, so a recipe dropped mid-save can't deprioritize itself.
export function townFailureHoldWeightFromMap(
  map: TownItemPriorityMap,
  town: TownContent,
  recipe: RecipeContent,
): number {
  if (town.crafting.uniqueRecipeIds.includes(recipe.id)) return 1;

  const heldByOther = recipe.requirements.some((requirement) => {
    if (!('itemId' in requirement)) return false;

    const holders = map.heldByItem[requirement.itemId];
    return !!holders && holders.some((holderId) => holderId !== recipe.id);
  });

  return heldByOther ? TOWN_SPECIALTY_FAILURE_HOLD_WEIGHT_PENALTY : 1;
}

export function townFailureHoldWeight(
  priority: TownSpecialtyPriorityEntry[],
  town: TownContent,
  recipe: RecipeContent,
): number {
  return townFailureHoldWeightFromMap(
    townItemPriorityMap(priority),
    town,
    recipe,
  );
}

export function townCommissionPriorityWeightFromMap(
  priority: TownSpecialtyPriorityEntry[],
  map: TownItemPriorityMap,
  offer: CommissionOfferContent,
  offerWeight: number,
): number {
  const linkedEntry = activeEntries(priority).find(
    (entry) => entry.recipeId === offer.specialtyForRecipeId,
  );
  if (linkedEntry) {
    // Divided out of the offer's own authored weight (the caller always multiplies by it) - must win on failureCount alone.
    const dominance = priorityMultiplier(
      linkedEntry.failureCount,
      TOWN_SPECIALTY_COMMISSION_WEIGHT_PER_FAILURE,
      Number.POSITIVE_INFINITY,
    );
    return offerWeight > 0 ? dominance / offerWeight : dominance;
  }

  const itemWeights = offer.requirements
    .filter((requirement) => 'itemId' in requirement)
    .map((requirement) =>
      townItemPriorityWeightFromMap(map, requirement.itemId),
    );

  return itemWeights.length === 0 ? 1 : Math.max(1, ...itemWeights);
}

export function townCommissionPriorityWeight(
  priority: TownSpecialtyPriorityEntry[],
  offer: CommissionOfferContent,
  offerWeight: number,
): number {
  return townCommissionPriorityWeightFromMap(
    priority,
    townItemPriorityMap(priority),
    offer,
    offerWeight,
  );
}
