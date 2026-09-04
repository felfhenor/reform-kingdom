import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/town-materials', () => ({
  townMaterialQuantity: vi.fn(),
}));

import { townMaterialQuantity } from '@helpers/town/town-materials';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import type { ItemId, RecipeContent, TownId } from '@interfaces';

const townId = 'larsia' as TownId;
const oreId = 'ore' as ItemId;

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isRecipeCraftableByTown', () => {
  it('is craftable when item requirements are met, regardless of minTradeskillLevel', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(5);

    expect(
      isRecipeCraftableByTown(buildRecipe({ minTradeskillLevel: 50 }), townId),
    ).toBe(true);
  });

  it('is not craftable when the town lacks enough of a required item', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(1);

    expect(isRecipeCraftableByTown(buildRecipe(), townId)).toBe(false);
  });

  it('is never craftable if any requirement is equipment or a collectible', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);

    const equipmentGated = buildRecipe({
      requirements: [{ equipmentId: 'sword' as never }],
    });
    const collectibleGated = buildRecipe({
      requirements: [{ collectibleId: 'trophy' as never }],
    });

    expect(isRecipeCraftableByTown(equipmentGated, townId)).toBe(false);
    expect(isRecipeCraftableByTown(collectibleGated, townId)).toBe(false);
  });

  it('is never craftable if the result is a collectible', () => {
    vi.mocked(townMaterialQuantity).mockReturnValue(999);

    const recipe = buildRecipe({
      requirements: [],
      result: { collectibleId: 'trophy' as never },
    });

    expect(isRecipeCraftableByTown(recipe, townId)).toBe(false);
  });
});
