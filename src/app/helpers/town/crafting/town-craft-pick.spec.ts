import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngChoiceWeighted: vi.fn(),
}));

vi.mock('@helpers/town/crafting/town-craft-eligibility', () => ({
  isRecipeCraftableByTown: vi.fn(),
}));

import { getEntriesByType } from '@helpers/content/content';
import { rngChoiceWeighted } from '@helpers/rng';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import { townPickRecipeToQueue } from '@helpers/town/crafting/town-craft-pick';
import type {
  RecipeContent,
  RecipeId,
  TownContent,
  TownId,
  TradeskillId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const blacksmithingId = 'blacksmithing' as TradeskillId;
const woodworkingId = 'woodworking' as TradeskillId;

function buildRecipe(id: string, tradeskillId = blacksmithingId): RecipeContent {
  return { id: id as RecipeId, tradeskillId } as RecipeContent;
}

function buildTown(specialtyTradeskillId: TradeskillId): TownContent {
  return {
    id: townId,
    crafting: { specialtyTradeskillId },
  } as unknown as TownContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townPickRecipeToQueue', () => {
  it('returns undefined when no recipe is eligible', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildRecipe('a')]);
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(false);

    expect(townPickRecipeToQueue(buildTown(blacksmithingId))).toBeUndefined();
    expect(rngChoiceWeighted).not.toHaveBeenCalled();
  });

  it('filters to recipes eligible across all tradeskills, then weight-picks one', () => {
    const eligible = buildRecipe('b', woodworkingId);
    vi.mocked(getEntriesByType).mockReturnValue([
      buildRecipe('a', blacksmithingId),
      eligible,
    ]);
    vi.mocked(isRecipeCraftableByTown).mockImplementation(
      (recipe) => recipe.id === eligible.id,
    );
    vi.mocked(rngChoiceWeighted).mockImplementation((choices) => choices[0]);

    const result = townPickRecipeToQueue(buildTown(blacksmithingId));

    expect(isRecipeCraftableByTown).toHaveBeenCalledWith(eligible, townId);
    expect(rngChoiceWeighted).toHaveBeenCalledWith([eligible], expect.any(Function));
    expect(result).toEqual({ tradeskillId: woodworkingId, recipe: eligible });
  });

  it('returns undefined if rngChoiceWeighted has nothing to pick from (zero total weight)', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildRecipe('a')]);
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(true);
    vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);

    expect(townPickRecipeToQueue(buildTown(blacksmithingId))).toBeUndefined();
  });

  it('weights a specialty-tradeskill recipe higher than a non-specialty one', () => {
    const specialtyRecipe = buildRecipe('a', woodworkingId);
    const otherRecipe = buildRecipe('b', blacksmithingId);
    vi.mocked(getEntriesByType).mockReturnValue([specialtyRecipe, otherRecipe]);
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(true);
    let weightFn: (recipe: RecipeContent) => number = () => 0;
    vi.mocked(rngChoiceWeighted).mockImplementation((choices, fn) => {
      weightFn = fn;
      return choices[0];
    });

    townPickRecipeToQueue(buildTown(woodworkingId));

    expect(weightFn(specialtyRecipe)).toBeGreaterThan(weightFn(otherRecipe));
  });
});
