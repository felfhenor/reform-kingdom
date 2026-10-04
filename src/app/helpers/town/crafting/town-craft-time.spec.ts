import { describe, expect, it } from 'vitest';

import { TRADESKILL_MAX_LEVEL } from '@helpers/config';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { townCraftTimeFor } from '@helpers/town/crafting/town-craft-time';

const recipe = (craftTime: number) => ensureRecipe({ craftTime });
const town = (craftingDurationMultiplier = 1) =>
  ensureTown({ crafting: { craftingDurationMultiplier } });

describe('townCraftTimeFor', () => {
  it('takes 1% off per tradeskill level', () => {
    expect(townCraftTimeFor(recipe(100), town(), 25)).toBe(75);
  });

  it('scales by the town’s duration multiplier and any debuff', () => {
    expect(townCraftTimeFor(recipe(100), town(2), 25)).toBe(150);
    expect(townCraftTimeFor(recipe(100), town(), 25, 2)).toBe(150);
  });

  it('rounds to whole ticks, never below 1', () => {
    expect(townCraftTimeFor(recipe(10), town(), 3)).toBe(10);
    expect(townCraftTimeFor(recipe(1), town(), TRADESKILL_MAX_LEVEL, 0.1)).toBe(
      1,
    );
  });

  it('treats levels outside 1..max as the nearest bound', () => {
    const at = (level: number) => townCraftTimeFor(recipe(100), town(), level);

    expect(at(999)).toBe(at(TRADESKILL_MAX_LEVEL));
    expect(at(0)).toBe(at(1));
  });
});
