import { beforeEach, describe, expect, it } from 'vitest';

import {
  TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT,
  TOWN_PRIORITY_WEIGHT_PER_FAILURE,
  TOWN_SPECIALTY_COMMISSION_WEIGHT_PER_FAILURE,
  TOWN_SPECIALTY_FAILURE_HOLD_THRESHOLD,
  TOWN_SPECIALTY_FAILURE_HOLD_WEIGHT_PENALTY,
} from '@helpers/config';
import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import {
  townCommissionPriorityWeight,
  townFailureHoldWeight,
  townItemPriorityMap,
  townItemPriorityWeight,
  townRecipeRespectsReservations,
  townReservedMaterialQuantity,
} from '@helpers/town/crafting/town-craft-priority-weight';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  ItemId,
  RecipeContent,
  RecipeId,
  TownContent,
  TownId,
  TownSpecialtyPriorityEntry,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const cactspine = 'cactspine' as ItemId;
const petrifiwood = 'petrifiwood' as ItemId;

function recipe(id: string, ...itemIds: ItemId[]): RecipeContent {
  return ensureRecipe({
    id: id as RecipeId,
    name: id,
    requirements: itemIds.map((itemId) => ({ itemId, quantity: 2 })),
  });
}

const ring = recipe('ring', cactspine);
const pendant = recipe('pendant', cactspine);
const other = recipe('other', cactspine);
const staff = recipe('staff', petrifiwood);
const mixed = recipe('mixed', cactspine, petrifiwood);

function town(uniqueRecipeIds: RecipeId[] = []): TownContent {
  return ensureTown({
    id: 'larsia' as TownId,
    name: 'Larsia',
    crafting: { uniqueRecipeIds },
  });
}

function struggling(
  failureCount: number,
  ...recipes: RecipeContent[]
): TownSpecialtyPriorityEntry[] {
  return recipes.map(({ id }) => ({ recipeId: id, failureCount }));
}

const held = TOWN_SPECIALTY_FAILURE_HOLD_THRESHOLD + 1;
const weightAt = (failures: number) =>
  1 +
  TOWN_PRIORITY_WEIGHT_PER_FAILURE *
    Math.min(failures, TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT);

function seedCactspine(quantity: number): void {
  seedGamestate((state) => {
    state.world.towns[town().id] = buildTownNodeState({
      materials: { [cactspine]: quantity },
    });
  });
}

beforeEach(() => {
  seedContent([ring, pendant, other, staff, mixed]);
});

describe('townItemPriorityWeight', () => {
  it('raises the weight of a struggling recipe’s materials with each failure, up to the cap', () => {
    expect(townItemPriorityWeight(struggling(4, ring), cactspine)).toBe(
      weightAt(4),
    );
    expect(
      townItemPriorityWeight(
        struggling(TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT + 50, ring),
        cactspine,
      ),
    ).toBe(weightAt(TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT));
  });

  it('stays neutral for unneeded materials, untouched recipes and recipes gone from content', () => {
    expect(townItemPriorityWeight(struggling(4, ring), petrifiwood)).toBe(1);
    expect(townItemPriorityWeight(struggling(0, ring), cactspine)).toBe(1);
    expect(
      townItemPriorityWeight(
        [{ recipeId: 'gone' as RecipeId, failureCount: 4 }],
        cactspine,
      ),
    ).toBe(1);
  });

  it('takes the strongest weight when several recipes need the same material', () => {
    expect(
      townItemPriorityWeight(
        [...struggling(6, pendant), ...struggling(2, ring)],
        cactspine,
      ),
    ).toBe(weightAt(6));
  });
});

describe('townReservedMaterialQuantity', () => {
  it('reserves what every struggling recipe needs, less the asking recipe’s own share', () => {
    const priority = struggling(1, ring, pendant);

    expect(townReservedMaterialQuantity(priority, cactspine)).toBe(4);
    expect(townReservedMaterialQuantity(priority, cactspine, ring.id)).toBe(2);
    expect(townReservedMaterialQuantity(priority, petrifiwood)).toBe(0);
    expect(townReservedMaterialQuantity(struggling(0, ring), cactspine)).toBe(
      0,
    );
  });
});

describe('townRecipeRespectsReservations', () => {
  it('lets other recipes spend only what is left above the reservation', () => {
    const priority = struggling(1, ring);

    seedCactspine(3);
    expect(townRecipeRespectsReservations(priority, town(), other)).toBe(false);

    seedCactspine(4);
    expect(townRecipeRespectsReservations(priority, town(), other)).toBe(true);

    seedCactspine(0);
    expect(townRecipeRespectsReservations([], town(), other)).toBe(true);
  });

  it('never blocks a struggling or specialty recipe, even on a shared scarce material', () => {
    const priority = struggling(1, ring, pendant);
    seedCactspine(2);

    expect(
      townRecipeRespectsReservations(
        priority,
        town([ring.id, pendant.id]),
        ring,
      ),
    ).toBe(true);
    expect(townRecipeRespectsReservations(priority, town(), ring)).toBe(true);
    expect(
      townRecipeRespectsReservations(priority, town([other.id]), other),
    ).toBe(true);
  });
});

describe('townFailureHoldWeight', () => {
  it('only marks a material held once its recipe passes the hold threshold', () => {
    expect(
      townItemPriorityMap(
        struggling(TOWN_SPECIALTY_FAILURE_HOLD_THRESHOLD, ring),
      ).heldByItem[cactspine],
    ).toBeUndefined();
    expect(
      townItemPriorityMap(struggling(held, ring)).heldByItem[cactspine],
    ).toEqual([ring.id]);
  });

  it('deprioritizes other recipes needing any held material', () => {
    const priority = struggling(held, ring);

    expect(townFailureHoldWeight(priority, town(), other)).toBe(
      TOWN_SPECIALTY_FAILURE_HOLD_WEIGHT_PENALTY,
    );
    expect(townFailureHoldWeight(priority, town(), mixed)).toBe(
      TOWN_SPECIALTY_FAILURE_HOLD_WEIGHT_PENALTY,
    );
    expect(townFailureHoldWeight(priority, town(), staff)).toBe(1);
  });

  it('never deprioritizes a specialty recipe, or the holder itself', () => {
    const priority = struggling(held, ring);

    expect(townFailureHoldWeight(priority, town([other.id]), other)).toBe(1);
    expect(townFailureHoldWeight(priority, town(), ring)).toBe(1);
  });
});

describe('townCommissionPriorityWeight', () => {
  function offer(
    specialtyForRecipeId: RecipeId,
    ...itemIds: ItemId[]
  ): CommissionOfferContent {
    return ensureCommissionOffer({
      id: 'offer' as CommissionOfferId,
      specialtyForRecipeId,
      requirements: itemIds.map((itemId) => ({
        itemId,
        quantityMin: 1,
        quantityMax: 1,
      })),
    });
  }

  it('boosts an offer feeding a struggling recipe without a cap, whatever its own weight', () => {
    const failures = TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT * 100;
    const priority = struggling(failures, ring);
    const linked = offer(ring.id);
    const dominance =
      1 + TOWN_SPECIALTY_COMMISSION_WEIGHT_PER_FAILURE * failures;

    expect(townCommissionPriorityWeight(priority, linked, 1)).toBe(dominance);
    expect(townCommissionPriorityWeight(priority, linked, 5) * 5).toBeCloseTo(
      dominance,
    );
  });

  it('otherwise follows the weight of the materials it asks for', () => {
    const priority = struggling(2, ring);

    expect(
      townCommissionPriorityWeight(
        priority,
        offer('x' as RecipeId, cactspine),
        1,
      ),
    ).toBe(weightAt(2));
    expect(
      townCommissionPriorityWeight(
        priority,
        offer('x' as RecipeId, petrifiwood),
        1,
      ),
    ).toBe(1);
    expect(
      townCommissionPriorityWeight(priority, offer('x' as RecipeId), 1),
    ).toBe(1);
  });
});
