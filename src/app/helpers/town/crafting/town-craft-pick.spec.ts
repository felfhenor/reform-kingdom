import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/crafting/town-craft-eligibility');
vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return {
    ...actual,
    rngChoiceWeighted: vi.fn(actual.rngChoiceWeighted),
  };
});

import {
  SPECIALTY_RECIPE_WEIGHT,
  TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT,
  TOWN_PRIORITY_WEIGHT_PER_FAILURE,
  TOWN_SPECIALTY_FAILURE_HOLD_THRESHOLD,
  TOWN_SPECIALTY_FAILURE_HOLD_WEIGHT_PENALTY,
} from '@helpers/config';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { rngChoiceWeighted } from '@helpers/rng';
import { isRecipeCraftableByTown } from '@helpers/town/crafting/town-craft-eligibility';
import { townPickRecipeToQueue } from '@helpers/town/crafting/town-craft-pick';
import type {
  ItemId,
  RecipeContent,
  RecipeId,
  TownId,
  TownSpecialtyPriorityEntry,
  TradeskillId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const smithing = 'smithing' as TradeskillId;
const woodworking = 'woodworking' as TradeskillId;
const cactspine = 'cactspine' as ItemId;
const petrifiwood = 'petrifiwood' as ItemId;

function recipe(
  id: string,
  tradeskillId: TradeskillId,
  ...itemIds: ItemId[]
): RecipeContent {
  return ensureRecipe({
    id: id as RecipeId,
    name: id,
    tradeskillId,
    requirements: itemIds.map((itemId) => ({ itemId, quantity: 2 })),
  });
}

const ring = recipe('ring', smithing, cactspine);
const staff = recipe('staff', woodworking, petrifiwood);
const blade = recipe('blade', smithing, petrifiwood);
const town = ensureTown({
  id: 'larsia' as TownId,
  name: 'Larsia',
  crafting: { specialtyTradeskillId: woodworking },
});

function seedTown(
  specialtyPriority: TownSpecialtyPriorityEntry[] = [],
  materials: Partial<Record<ItemId, number>> = {},
): void {
  seedGamestate((state) => {
    state.world.towns[town.id] = buildTownNodeState({
      specialtyPriority,
      materials,
    });
  });
}

// What the weighted pick was offered, with each recipe's weight resolved.
function offered(): Record<string, number> {
  const [recipes, weightOf] = vi.mocked(rngChoiceWeighted).mock.lastCall!;
  return Object.fromEntries(
    (recipes as RecipeContent[]).map((r) => [r.id, weightOf(r)]),
  );
}

beforeEach(() => {
  vi.mocked(rngChoiceWeighted).mockClear();
  vi.mocked(isRecipeCraftableByTown).mockReturnValue(true);
  seedContent([ring, staff, blade, town]);
  seedTown();
});

describe('townPickRecipeToQueue', () => {
  it('picks among every craftable recipe across tradeskills, favoring the town’s specialty', () => {
    vi.mocked(isRecipeCraftableByTown).mockImplementation(
      (candidate) => candidate.id !== blade.id,
    );

    const pick = townPickRecipeToQueue(town);

    expect(offered()).toEqual({ ring: 1, staff: SPECIALTY_RECIPE_WEIGHT });
    expect([ring, staff]).toContain(pick?.recipe);
    expect(pick?.tradeskillId).toBe(pick?.recipe.tradeskillId);
  });

  it('only offers recipes the caller accepts', () => {
    townPickRecipeToQueue(town, (candidate) => candidate.id === ring.id);

    expect(offered()).toEqual({ ring: 1 });
  });

  it('picks nothing when no recipe is craftable', () => {
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(false);

    expect(townPickRecipeToQueue(town)).toBeUndefined();
    expect(rngChoiceWeighted).not.toHaveBeenCalled();
  });

  it('boosts recipes using materials a struggling specialty recipe needs', () => {
    const struggling = recipe('struggling', woodworking, cactspine);
    seedContent([ring, staff, blade, struggling, town]);
    seedTown([{ recipeId: struggling.id, failureCount: 2 }], {
      [cactspine]: 10,
    });

    townPickRecipeToQueue(town, (candidate) => candidate.id === ring.id);

    expect(offered()).toEqual({
      ring: 1 + TOWN_PRIORITY_WEIGHT_PER_FAILURE * 2,
    });
  });

  it('skips recipes that would eat into materials reserved for a struggling recipe', () => {
    const struggling = recipe('struggling', woodworking, cactspine);
    seedContent([ring, staff, blade, struggling, town]);
    seedTown([{ recipeId: struggling.id, failureCount: 1 }], {
      [cactspine]: 3,
    });

    townPickRecipeToQueue(town, (candidate) => candidate.id !== struggling.id);

    expect(Object.keys(offered())).toEqual([staff.id, blade.id]);
  });

  it('deprioritizes, without excluding, recipes needing a material held for a long-failing recipe', () => {
    const struggling = recipe('struggling', woodworking, petrifiwood);
    seedContent([ring, staff, blade, struggling, town]);
    seedTown(
      [
        {
          recipeId: struggling.id,
          failureCount: TOWN_SPECIALTY_FAILURE_HOLD_THRESHOLD + 1,
        },
      ],
      { [petrifiwood]: 100 },
    );

    townPickRecipeToQueue(town, (candidate) => candidate.id === blade.id);

    const materialBoost =
      1 +
      TOWN_PRIORITY_WEIGHT_PER_FAILURE * TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT;
    expect(offered()['blade']).toBeCloseTo(
      materialBoost * TOWN_SPECIALTY_FAILURE_HOLD_WEIGHT_PENALTY,
    );
  });
});
