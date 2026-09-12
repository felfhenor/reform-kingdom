import type {
  EncounterContent,
  EncounterId,
  RecipeContent,
  RecipeId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
}));

import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { getEntriesByType } from '@helpers/content/content';
import { recipeSourceNodeNames } from '@helpers/kingdom/museum';

const boneHewnCloakRecipe: RecipeContent = {
  id: 'equipment-bone-hewn-cloak' as RecipeId,
  name: 'Equipment: Bone-Hewn Cloak',
  __type: 'recipe',
  result: { equipmentId: 'bone-hewn-cloak' as never },
  requirements: [],
  tradeskillId: 'tailoring-id' as never,
  minTradeskillLevel: 2,
  maxTradeskillLevel: 5,
  tradeskillXP: 1,
  craftTime: 60,
  tokenUnlockCost: 3,
};

const copperIngotRecipe: RecipeContent = {
  id: 'material-copper-ingot' as RecipeId,
  name: 'Material: Copper Ingot',
  __type: 'recipe',
  result: { itemId: 'copper-ingot' as never, quantity: 1 },
  requirements: [],
  tradeskillId: 'blacksmithing-id' as never,
  minTradeskillLevel: 1,
  maxTradeskillLevel: 3,
  tradeskillXP: 1,
  craftTime: 60,
  tokenUnlockCost: 3,
};

const fieldRuinsEncounter: EncounterContent = {
  id: 'field-ruins' as EncounterId,
  name: 'Field Ruins',
  __type: 'encounter',
  description: 'A ruined field.',
  levelRange: { min: 1, max: 5 },
  fights: [],
  completionRewards: [
    ensureDroppedReward({
      recipeId: boneHewnCloakRecipe.id,
      chance: 0.25,
    }),
  ],
};

const alekiaTrader = {
  id: 'alekia-figaro' as never,
  name: 'Alekia Figaro',
  __type: 'caravantrader',
  description: 'I deal in mystical recipes.',
  category: 'Carrina',
  level: 15,
  trades: [
    {
      type: 'sell',
      value: 25000,
      recipeId: copperIngotRecipe.id,
      weight: 1,
    },
  ],
  tokenTrades: [],
} as never;

describe('Museum Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recipeSourceNodeNames', () => {
    it('returns the names of encounters that can drop the recipe', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) => (type === 'encounter' ? [fieldRuinsEncounter] : []) as never,
      );

      expect(recipeSourceNodeNames(boneHewnCloakRecipe.id)).toEqual([
        'Field Ruins',
      ]);
    });

    it('excludes encounters whose rewards do not include the recipe', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) => (type === 'encounter' ? [fieldRuinsEncounter] : []) as never,
      );

      expect(recipeSourceNodeNames(copperIngotRecipe.id)).toEqual([]);
    });

    it('returns the names of caravan traders that sell the recipe', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) => (type === 'caravantrader' ? [alekiaTrader] : []) as never,
      );

      expect(recipeSourceNodeNames(copperIngotRecipe.id)).toEqual([
        'Alekia Figaro',
      ]);
    });
  });
});
