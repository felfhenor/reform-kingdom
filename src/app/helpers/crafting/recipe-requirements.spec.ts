import { describe, expect, it } from 'vitest';

import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { recipeKingdomRequirements } from '@helpers/crafting/recipe-requirements';
import type { CollectibleId, EquipmentId, ItemId } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';

const recipe = ensureRecipe({
  requirements: [
    { itemId: 'ore' as ItemId, quantity: 3 },
    { itemId: 'coal' as ItemId, quantity: 1 },
    { equipmentId: 'sword' as EquipmentId },
    { collectibleId: 'hammer' as CollectibleId },
  ],
});

function withBoost(boost: number) {
  seedGamestate((state) => {
    state.globalEffectSums.tradeskillMaterialBoost = boost;
  });
  return recipeKingdomRequirements(recipe);
}

describe('recipeKingdomRequirements', () => {
  it('returns the base requirements with no boost', () => {
    expect(withBoost(0)).toBe(recipe.requirements);
  });

  it('scales every material, rounding down, leaving gear and collectibles alone', () => {
    expect(withBoost(0.5)).toEqual([
      { itemId: 'ore', quantity: 4 },
      { itemId: 'coal', quantity: 1 },
      { equipmentId: 'sword' },
      { collectibleId: 'hammer' },
    ]);
  });

  it('never drops a material below 1', () => {
    expect(withBoost(-1).slice(0, 2)).toEqual([
      { itemId: 'ore', quantity: 1 },
      { itemId: 'coal', quantity: 1 },
    ]);
  });
});
