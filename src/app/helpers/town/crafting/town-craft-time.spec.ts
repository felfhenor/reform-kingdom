import { describe, expect, it } from 'vitest';

import { townCraftTimeFor } from '@helpers/town/crafting/town-craft-time';
import type { RecipeContent, TownContent } from '@interfaces';

function buildTown(craftingDurationMultiplier = 1): TownContent {
  return {
    crafting: { craftingDurationMultiplier },
  } as unknown as TownContent;
}

function buildRecipe(craftTime: number): RecipeContent {
  return { craftTime } as unknown as RecipeContent;
}

describe('townCraftTimeFor', () => {
  it('reduces craft time by 1% per level', () => {
    expect(townCraftTimeFor(buildRecipe(100), buildTown(), 25)).toBe(75);
  });

  it('applies the town craftingDurationMultiplier before the level reduction', () => {
    expect(townCraftTimeFor(buildRecipe(100), buildTown(2), 25)).toBe(150);
  });

  it('applies an extra debuff multiplier on top', () => {
    expect(townCraftTimeFor(buildRecipe(100), buildTown(), 25, 2)).toBe(150);
  });

  it('never goes below 1 tick even at max level with a tiny craft time', () => {
    expect(townCraftTimeFor(buildRecipe(1), buildTown(), 50)).toBe(1);
  });

  it('clamps a level above TRADESKILL_MAX_LEVEL to the cap', () => {
    expect(townCraftTimeFor(buildRecipe(100), buildTown(), 999)).toBe(
      townCraftTimeFor(buildRecipe(100), buildTown(), 50),
    );
  });

  it('clamps a level below 1 up to 1', () => {
    expect(townCraftTimeFor(buildRecipe(100), buildTown(), 0)).toBe(
      townCraftTimeFor(buildRecipe(100), buildTown(), 1),
    );
  });

  it('rounds to the nearest tick', () => {
    expect(townCraftTimeFor(buildRecipe(10), buildTown(), 3)).toBe(10);
  });
});
