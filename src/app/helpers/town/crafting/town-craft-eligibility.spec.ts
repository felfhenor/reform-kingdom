import { describe, expect, it } from 'vitest';

import { TOWN_RECIPE_OUTPUT_DUPLICATE_CAP } from '@helpers/config';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import type {
  CraftQueueEntryId,
  EquipmentId,
  ItemId,
  RecipeContent,
  RecipeId,
  TownContent,
  TownCraftQueueEntry,
  TownId,
  TownNodeState,
  TownStockEntry,
} from '@interfaces';
import { buildEquipmentItem, buildTownNodeState } from '@/testing/builders';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const oreId = 'ore' as ItemId;
const ingotId = 'ingot' as ItemId;
const swordId = 'sword' as EquipmentId;

function town(crafting: Partial<TownContent['crafting']> = {}): TownContent {
  return ensureTown({
    id: townId,
    crafting: crafting as TownContent['crafting'],
    materialThresholds: [
      { itemId: ingotId, maxQuantity: 50 },
    ] as TownContent['materialThresholds'],
  });
}

function recipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  return ensureRecipe({
    id: 'recipe' as RecipeId,
    result: { itemId: ingotId, quantity: 1 },
    requirements: [{ itemId: oreId, quantity: 2 }],
    ...overrides,
  });
}

const swordRecipe = recipe({
  id: 'sword-recipe' as RecipeId,
  requirements: [],
  result: { equipmentId: swordId },
});

function seedTown(overrides: Partial<TownNodeState> = {}): void {
  seedGamestate((state) => {
    state.world.towns[townId] = buildTownNodeState({
      materials: { [oreId]: 999 },
      ...overrides,
    });
  });
}

function stockedSwords(count: number): TownStockEntry[] {
  return Array.from({ length: count }, () => ({
    equipmentItem: buildEquipmentItem(swordId),
    addedAtTick: 0,
  }));
}

function queued(recipeId: RecipeId, count: number): TownCraftQueueEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i}` as CraftQueueEntryId,
    tradeskillId: 'blacksmithing' as never,
    recipeId,
    ticksIntoCraft: 0,
  }));
}

describe('isRecipeCraftableByTown', () => {
  it('needs enough of every item requirement, ignoring the recipe level', () => {
    seedTown({ materials: { [oreId]: 2 } });
    expect(
      isRecipeCraftableByTown(recipe({ minTradeskillLevel: 50 }), town()),
    ).toBe(true);

    seedTown({ materials: { [oreId]: 1 } });
    expect(isRecipeCraftableByTown(recipe(), town())).toBe(false);
  });

  it('can never satisfy an equipment or collectible requirement', () => {
    seedTown();

    expect(
      isRecipeCraftableByTown(
        recipe({ requirements: [{ equipmentId: swordId }] }),
        town(),
      ),
    ).toBe(false);
    expect(
      isRecipeCraftableByTown(
        recipe({ requirements: [{ collectibleId: 'trophy' as never }] }),
        town(),
      ),
    ).toBe(false);
  });

  it('never crafts a collectible result', () => {
    seedTown();

    expect(
      isRecipeCraftableByTown(
        recipe({
          requirements: [],
          result: { collectibleId: 'trophy' as never },
        }),
        town(),
      ),
    ).toBe(false);
  });

  it("never crafts a recipe in the town's bannedRecipeIds", () => {
    seedTown();

    expect(
      isRecipeCraftableByTown(
        recipe(),
        town({ bannedRecipeIds: [recipe().id] }),
      ),
    ).toBe(false);
  });

  it('stops crafting a material once the town holds its threshold', () => {
    seedTown({ materials: { [oreId]: 999, [ingotId]: 49 } });
    expect(isRecipeCraftableByTown(recipe(), town())).toBe(true);

    seedTown({ materials: { [oreId]: 999, [ingotId]: 50 } });
    expect(isRecipeCraftableByTown(recipe(), town())).toBe(false);
  });

  it('caps equipment copies across shop stock and queue combined', () => {
    seedTown({
      stock: [
        ...stockedSwords(TOWN_RECIPE_OUTPUT_DUPLICATE_CAP - 2),
        {
          equipmentItem: buildEquipmentItem('axe' as EquipmentId),
          addedAtTick: 0,
        },
      ],
      craftQueue: [
        ...queued(swordRecipe.id, 1),
        ...queued('other' as RecipeId, 3),
      ],
    });
    expect(isRecipeCraftableByTown(swordRecipe, town())).toBe(true);

    seedTown({
      stock: stockedSwords(TOWN_RECIPE_OUTPUT_DUPLICATE_CAP - 1),
      craftQueue: queued(swordRecipe.id, 1),
    });
    expect(isRecipeCraftableByTown(swordRecipe, town())).toBe(false);
  });

  it('counts only the queue toward the cap for a material result', () => {
    seedTown({
      craftQueue: queued(recipe().id, TOWN_RECIPE_OUTPUT_DUPLICATE_CAP - 1),
    });
    expect(isRecipeCraftableByTown(recipe(), town())).toBe(true);

    seedTown({
      craftQueue: queued(recipe().id, TOWN_RECIPE_OUTPUT_DUPLICATE_CAP),
    });
    expect(isRecipeCraftableByTown(recipe(), town())).toBe(false);
  });
});
