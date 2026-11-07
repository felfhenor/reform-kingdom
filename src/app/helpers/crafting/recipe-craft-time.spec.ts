import { describe, expect, it } from 'vitest';

import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { recipeCraftTime } from '@helpers/crafting/recipe-craft-time';
import { seedGamestate } from '@/testing/gamestate';

function withBonus(bonus: number, craftTime: number) {
  seedGamestate((state) => {
    state.globalEffectSums.craftTimeMultiplierBonus = bonus;
  });
  return recipeCraftTime(ensureRecipe({ craftTime }));
}

describe('recipeCraftTime', () => {
  it('returns the base time with no bonus', () => {
    expect(withBonus(0, 60)).toBe(60);
  });

  it('scales by the bonus, rounded to whole ticks', () => {
    expect(withBonus(-0.5, 60)).toBe(30);
    expect(withBonus(-0.5, 5)).toBe(3);
    expect(withBonus(0.5, 60)).toBe(90);
  });

  it('never drops below 1 tick', () => {
    expect(withBonus(-0.5, 1)).toBe(1);
    expect(withBonus(-2, 60)).toBe(1);
  });
});
