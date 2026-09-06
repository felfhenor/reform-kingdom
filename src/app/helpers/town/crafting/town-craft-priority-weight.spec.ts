import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/town/town-materials', () => ({
  townMaterialQuantity: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { townMaterialQuantity } from '@helpers/town/town-materials';
import {
  townCommissionPriorityWeight,
  townItemPriorityMap,
  townItemPriorityWeight,
  townItemPriorityWeightFromMap,
  townRecipeRespectsReservations,
  townReservedMaterialQuantity,
  townReservedMaterialQuantityFromMap,
} from '@helpers/town/crafting/town-craft-priority-weight';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  ItemId,
  RecipeContent,
  RecipeId,
  TownId,
  TownSpecialtyPriorityEntry,
} from '@interfaces';

const townId = 'larsia' as TownId;
const cactspineId = 'cactspine' as ItemId;
const petrifiwoodId = 'petrifiwood' as ItemId;
const ringRecipeId = 'ring-recipe' as RecipeId;
const otherRecipeId = 'other-recipe' as RecipeId;

function buildRecipe(
  id: RecipeId,
  requirements: { itemId: ItemId; quantity: number }[],
): RecipeContent {
  return { id, requirements } as unknown as RecipeContent;
}

const ringRecipe = buildRecipe(ringRecipeId, [
  { itemId: cactspineId, quantity: 2 },
]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntry).mockImplementation((id) =>
    id === ringRecipeId ? (ringRecipe as never) : undefined,
  );
});

describe('townItemPriorityMap', () => {
  it('builds one weight/reservation entry per requirement, computed once for the whole priority list', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 2 },
    ];

    const map = townItemPriorityMap(priority);

    expect(getEntry).toHaveBeenCalledTimes(1);
    expect(townItemPriorityWeightFromMap(map, cactspineId)).toBe(1 + 0.5 * 2);
    expect(townReservedMaterialQuantityFromMap(map, cactspineId)).toBe(2);
  });

  it('is empty for an item no active priority entry needs', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 2 },
    ];

    const map = townItemPriorityMap(priority);

    expect(townItemPriorityWeightFromMap(map, petrifiwoodId)).toBe(1);
    expect(townReservedMaterialQuantityFromMap(map, petrifiwoodId)).toBe(0);
  });

  it('excludes a given recipe from its own reservation via the same precomputed map', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 1 },
    ];

    const map = townItemPriorityMap(priority);

    expect(
      townReservedMaterialQuantityFromMap(map, cactspineId, ringRecipeId),
    ).toBe(0);
  });
});

describe('townItemPriorityWeight', () => {
  it('is neutral (1) with no active priority entries', () => {
    expect(townItemPriorityWeight([], cactspineId)).toBe(1);
  });

  it('is neutral for a priority entry with a zero failure count', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 0 },
    ];

    expect(townItemPriorityWeight(priority, cactspineId)).toBe(1);
  });

  it('escalates with failureCount for an item the priority recipe needs', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 4 },
    ];

    expect(townItemPriorityWeight(priority, cactspineId)).toBe(1 + 0.5 * 4);
  });

  it('is neutral for an item the priority recipe does not need', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 4 },
    ];

    expect(townItemPriorityWeight(priority, petrifiwoodId)).toBe(1);
  });

  it('caps the weight past the max-failures ceiling', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 999 },
    ];

    expect(townItemPriorityWeight(priority, cactspineId)).toBe(1 + 0.5 * 20);
  });
});

describe('townReservedMaterialQuantity', () => {
  it('sums the item requirement across active priority entries needing it', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 1 },
    ];

    expect(townReservedMaterialQuantity(priority, cactspineId)).toBe(2);
  });

  it('ignores entries with a zero failure count', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 0 },
    ];

    expect(townReservedMaterialQuantity(priority, cactspineId)).toBe(0);
  });

  it('excludes the given recipe from its own reservation', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 1 },
    ];

    expect(
      townReservedMaterialQuantity(priority, cactspineId, ringRecipeId),
    ).toBe(0);
  });
});

describe('townRecipeRespectsReservations', () => {
  it('is true when nothing is reserved', () => {
    const otherRecipe = buildRecipe(otherRecipeId, [
      { itemId: cactspineId, quantity: 2 },
    ]);

    expect(townRecipeRespectsReservations([], townId, otherRecipe)).toBe(true);
  });

  it('blocks another recipe from dipping below the reserved amount', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 1 },
    ];
    const otherRecipe = buildRecipe(otherRecipeId, [
      { itemId: cactspineId, quantity: 2 },
    ]);
    vi.mocked(townMaterialQuantity).mockReturnValue(3);

    expect(
      townRecipeRespectsReservations(priority, townId, otherRecipe),
    ).toBe(false);
  });

  it('does not block the priority recipe itself from using its own reservation', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 1 },
    ];
    vi.mocked(townMaterialQuantity).mockReturnValue(2);

    expect(townRecipeRespectsReservations(priority, townId, ringRecipe)).toBe(
      true,
    );
  });
});

describe('townCommissionPriorityWeight', () => {
  function buildOffer(
    specialtyForRecipeId: RecipeId,
    requirements: { itemId: ItemId }[] = [],
  ): CommissionOfferContent {
    return {
      id: 'offer' as CommissionOfferId,
      requirements,
      specialtyForRecipeId,
    } as unknown as CommissionOfferContent;
  }

  it('applies the dedicated, uncapped multiplier when linked to an active priority entry', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 2 },
    ];
    const offer = buildOffer(ringRecipeId);

    expect(townCommissionPriorityWeight(priority, offer, 1)).toBe(1 + 1 * 2);
  });

  it('never loses to a competing offer with a higher authored weight - not capped at 20 failures like per-item weights', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 10476 },
    ];
    const offer = buildOffer(ringRecipeId);

    // Multiplying the result back by the offer's own authored weight (as the real call site does) must cancel it out.
    const offerWeight = 1;
    const result = townCommissionPriorityWeight(priority, offer, offerWeight) * offerWeight;

    expect(result).toBe(1 + 1 * 10476);
  });

  it('divides out the offer authored weight so the final effective weight is weight-independent', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 20 },
    ];
    const offer = buildOffer(ringRecipeId);

    expect(townCommissionPriorityWeight(priority, offer, 1) * 1).toBe(
      townCommissionPriorityWeight(priority, offer, 5) * 5,
    );
  });

  it('falls back to the per-item weight (capped at 20 failures) when not linked to an active entry', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 2 },
    ];
    const offer = buildOffer('UNKNOWN' as RecipeId, [{ itemId: cactspineId }]);

    expect(townCommissionPriorityWeight(priority, offer, 1)).toBe(1 + 0.5 * 2);
  });

  it('is neutral for an offer with no matching link or needed item', () => {
    const offer = buildOffer('UNKNOWN' as RecipeId, [{ itemId: petrifiwoodId }]);

    expect(townCommissionPriorityWeight([], offer, 1)).toBe(1);
  });
});
