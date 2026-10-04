import { describe, expect, it } from 'vitest';

import { ensureCaravanTrader } from '@helpers/content/ensure-caravan';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { recipeSourceNodeNames } from '@helpers/kingdom/museum';
import type { CaravanTraderId, EncounterId, RecipeId } from '@interfaces';
import { seedContent } from '@/testing/content';

const cloakRecipe = 'equipment-bone-hewn-cloak' as RecipeId;
const ingotRecipe = 'material-copper-ingot' as RecipeId;
const mapRecipe = 'collectible-map' as RecipeId;

describe('recipeSourceNodeNames', () => {
  it('names the encounters that drop a recipe and the traders that sell it', () => {
    seedContent([
      ensureEncounter({
        id: 'field-ruins' as EncounterId,
        name: 'Field Ruins',
        completionRewards: [
          ensureDroppedReward({ recipeId: cloakRecipe, chance: 0.25 }),
        ],
      }),
      ensureCaravanTrader({
        id: 'alekia-figaro' as CaravanTraderId,
        name: 'Alekia Figaro',
        trades: [
          { type: 'sell', value: 25000, recipeId: ingotRecipe, weight: 1 },
        ],
        tokenTrades: [{ tokenCost: 3, recipeId: mapRecipe }],
      }),
    ]);

    expect(recipeSourceNodeNames(cloakRecipe)).toEqual(['Field Ruins']);
    expect(recipeSourceNodeNames(ingotRecipe)).toEqual(['Alekia Figaro']);
    expect(recipeSourceNodeNames(mapRecipe)).toEqual(['Alekia Figaro']);
    expect(recipeSourceNodeNames('unsourced' as RecipeId)).toEqual([]);
  });
});
