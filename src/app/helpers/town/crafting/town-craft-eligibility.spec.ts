import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/town-materials', () => ({
  townMaterialQuantity: vi.fn(),
}));

vi.mock('@helpers/town/town-resource-thresholds', () => ({
  townMaterialAtOrAboveThreshold: vi.fn(() => false),
}));

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    worldTownsState: () => gamestate().world.towns,
  };
});

import { gamestate } from '@helpers/state-game';
import { townMaterialQuantity } from '@helpers/town/town-materials';
import { townMaterialAtOrAboveThreshold } from '@helpers/town/town-resource-thresholds';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import type {
  GameState,
  ItemId,
  RecipeContent,
  TownContent,
  TownId,
  TownNodeState,
} from '@interfaces';

const townId = 'larsia' as TownId;
const oreId = 'ore' as ItemId;
const town = {
  id: townId,
  crafting: { bannedRecipeIds: [] },
} as unknown as TownContent;

function buildRecipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  return {
    result: { itemId: 'ingot' as ItemId, quantity: 1 },
    requirements: [{ itemId: oreId, quantity: 2 }],
    minTradeskillLevel: 1,
    maxTradeskillLevel: 3,
    tradeskillXP: 1,
    craftTime: 5,
    ...overrides,
  } as RecipeContent;
}

function mockTownState(overrides: Partial<TownNodeState> = {}): void {
  vi.mocked(gamestate).mockReturnValue({
    world: {
      towns: {
        [townId]: { stock: [], craftQueue: [], ...overrides },
      },
    },
  } as unknown as GameState);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTownState();
});

describe('isRecipeCraftableByTown', () => {
  it('is craftable when item requirements are met, regardless of minTradeskillLevel', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(5);

    expect(
      isRecipeCraftableByTown(buildRecipe({ minTradeskillLevel: 50 }), town),
    ).toBe(true);
  });

  it('is not craftable when the town lacks enough of a required item', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(1);

    expect(isRecipeCraftableByTown(buildRecipe(), town)).toBe(false);
  });

  it('is never craftable if any requirement is equipment or a collectible', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);

    const equipmentGated = buildRecipe({
      requirements: [{ equipmentId: 'sword' as never }],
    });
    const collectibleGated = buildRecipe({
      requirements: [{ collectibleId: 'trophy' as never }],
    });

    expect(isRecipeCraftableByTown(equipmentGated, town)).toBe(false);
    expect(isRecipeCraftableByTown(collectibleGated, town)).toBe(false);
  });

  it('is never craftable if the result is a collectible', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);

    const recipe = buildRecipe({
      requirements: [],
      result: { collectibleId: 'trophy' as never },
    });

    expect(isRecipeCraftableByTown(recipe, town)).toBe(false);
  });

  it('is not craftable when the resulting material is already at or above its town threshold', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);
    vi.mocked(townMaterialAtOrAboveThreshold).mockReturnValue(true);

    expect(isRecipeCraftableByTown(buildRecipe(), town)).toBe(false);
  });

  it('is craftable when the result is equipment, regardless of material thresholds', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);
    vi.mocked(townMaterialAtOrAboveThreshold).mockReturnValue(true);

    const recipe = buildRecipe({
      requirements: [],
      result: { equipmentId: 'sword' as never },
    });

    expect(isRecipeCraftableByTown(recipe, town)).toBe(true);
  });

  it("is never craftable if the recipe is in the town's bannedRecipeIds, even with materials to spare", () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);
    const recipeId = 'banned-recipe' as RecipeContent['id'];
    const bannedTown = {
      id: townId,
      crafting: { bannedRecipeIds: [recipeId] },
    } as unknown as TownContent;

    expect(
      isRecipeCraftableByTown(buildRecipe({ id: recipeId }), bannedTown),
    ).toBe(false);
  });

  it('is craftable when combined shop+queue copies of an equipment result are below the duplicate cap', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);
    mockTownState({
      stock: [
        { equipmentItem: { equipmentId: 'sword' }, addedAtTick: 0 },
      ] as never,
      craftQueue: [{ recipeId: 'other-recipe' }] as never,
    });
    const recipe = buildRecipe({
      requirements: [],
      result: { equipmentId: 'sword' as never },
    });

    expect(isRecipeCraftableByTown(recipe, town)).toBe(true);
  });

  it('is not craftable once combined shop+queue copies of an equipment result reach the duplicate cap', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);
    const recipe = buildRecipe({
      id: 'sword-recipe' as RecipeContent['id'],
      requirements: [],
      result: { equipmentId: 'sword' as never },
    });
    mockTownState({
      stock: [
        { equipmentItem: { equipmentId: 'sword' }, addedAtTick: 0 },
        { equipmentItem: { equipmentId: 'sword' }, addedAtTick: 0 },
      ] as never,
      craftQueue: [{ recipeId: recipe.id }] as never,
    });

    expect(isRecipeCraftableByTown(recipe, town)).toBe(false);
  });

  it('counts only the queue (not the shop) toward the duplicate cap for a material result', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);
    const recipe = buildRecipe({ id: 'ingot-recipe' as RecipeContent['id'] });
    mockTownState({
      craftQueue: [
        { recipeId: recipe.id },
        { recipeId: recipe.id },
        { recipeId: recipe.id },
      ] as never,
    });

    expect(isRecipeCraftableByTown(recipe, town)).toBe(false);
  });
});
