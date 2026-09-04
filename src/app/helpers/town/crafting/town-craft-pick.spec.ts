import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngChoice: vi.fn(),
}));

vi.mock('@helpers/town/crafting/town-craft-eligibility', () => ({
  isRecipeCraftableByTown: vi.fn(),
}));

import { getEntriesByType } from '@helpers/content/content';
import { rngChoice } from '@helpers/rng';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import { townPickRecipeToQueue } from '@helpers/town/crafting/town-craft-pick';
import type { RecipeContent, RecipeId, TownId, TradeskillId } from '@interfaces';

const townId = 'larsia' as TownId;
const blacksmithingId = 'blacksmithing' as TradeskillId;
const woodworkingId = 'woodworking' as TradeskillId;

function buildRecipe(id: string, tradeskillId = blacksmithingId): RecipeContent {
  return { id: id as RecipeId, tradeskillId } as RecipeContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townPickRecipeToQueue', () => {
  it('returns undefined when no recipe is eligible', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildRecipe('a')]);
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(false);

    expect(townPickRecipeToQueue(townId)).toBeUndefined();
    expect(rngChoice).not.toHaveBeenCalled();
  });

  it('filters to recipes eligible across all tradeskills, then picks one', () => {
    const eligible = buildRecipe('b', woodworkingId);
    vi.mocked(getEntriesByType).mockReturnValue([
      buildRecipe('a', blacksmithingId),
      eligible,
    ]);
    vi.mocked(isRecipeCraftableByTown).mockImplementation(
      (recipe) => recipe.id === eligible.id,
    );
    vi.mocked(rngChoice).mockImplementation((choices) => choices[0]);

    const result = townPickRecipeToQueue(townId);

    expect(isRecipeCraftableByTown).toHaveBeenCalledWith(eligible, townId);
    expect(rngChoice).toHaveBeenCalledWith([eligible]);
    expect(result).toEqual({ tradeskillId: woodworkingId, recipe: eligible });
  });
});
