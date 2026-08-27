import type {
  CollectibleContent,
  CollectibleId,
  EncounterContent,
  EncounterId,
  EquipmentContent,
  EquipmentId,
  GameState,
  GameStateDiscoveredRecipes,
  ItemContent,
  ItemId,
  RecipeContent,
  RecipeId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/kingdom/armory', () => ({
  getArmoryEntries: vi.fn(() => []),
}));

vi.mock('@helpers/item/collectibles', () => ({
  getCollectibleQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/item/equipment', () => ({
  equippedItems: vi.fn(() => []),
}));

vi.mock('@helpers/item/materials', () => ({
  getMaterialQuantity: vi.fn(() => 0),
  traderTokenId: vi.fn(() => 'trader-token'),
  applyMaterialDelta: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/hero/party', () => ({
  partyGet: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { getEntriesByType, getEntry } from '@helpers/content';
import {
  isRecipeCraftable,
  isRecipeDiscovered,
  isRecipeDropGated,
  pruneInvalidDiscoveredRecipes,
  recipeCanUnlockWithTokens,
  recipeDiscover,
  recipeResultContent,
  recipeResultOwnedQuantity,
  recipeResultSpritesheet,
  recipeUndiscover,
  recipeUnlockWithTokens,
} from '@helpers/crafting/recipes';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { partyGet } from '@helpers/hero/party';
import { getCollectibleQuantity } from '@helpers/item/collectibles';
import { equippedItems } from '@helpers/item/equipment';
import { applyMaterialDelta, getMaterialQuantity } from '@helpers/item/materials';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import { gamestate, updateGamestate } from '@helpers/state-game';

const copperIngot: ItemContent = {
  id: 'copper-ingot' as ItemId,
  name: 'Copper Ingot',
  __type: 'item',
  description: 'A refined copper ingot.',
  sprite: '0000',
  rarity: 'Common',
};

const boneHewnCloak: EquipmentContent = {
  id: 'bone-hewn-cloak' as EquipmentId,
  name: 'Bone-Hewn Cloak',
  __type: 'equipment',
  description: 'A cloak made of leather and bone.',
  sprite: '0017',
  rarity: 'Uncommon',
  levelRequirement: 4,
  baseStats: {} as never,
  type: 'Cloth Armor',
};

const itemRecipe: RecipeContent = {
  id: 'material-copper-ingot' as RecipeId,
  name: 'Material: Copper Ingot',
  __type: 'recipe',
  result: { itemId: copperIngot.id, quantity: 1 },
  requirements: [],
  tradeskillId: 'blacksmithing-id' as never,
  minTradeskillLevel: 1,
  maxTradeskillLevel: 3,
  tradeskillXP: 1,
  craftTime: 60,
  tokenUnlockCost: 3,
};

const equipmentRecipe: RecipeContent = {
  id: 'equipment-bone-hewn-cloak' as RecipeId,
  name: 'Equipment: Bone-Hewn Cloak',
  __type: 'recipe',
  result: { equipmentId: boneHewnCloak.id },
  requirements: [],
  tradeskillId: 'tailoring-id' as never,
  minTradeskillLevel: 2,
  maxTradeskillLevel: 5,
  tradeskillXP: 1,
  craftTime: 60,
  tokenUnlockCost: 3,
};

const minorEffigy: CollectibleContent = {
  id: 'minor-tailoring-effigy' as CollectibleId,
  name: 'Minor Tailoring Effigy',
  __type: 'collectible',
  description:
    'A small figurine stitched together from scraps of thread and cloth.',
  sprite: '0000',
  rarity: 'Uncommon',
};

const collectibleRecipe: RecipeContent = {
  id: 'collectible-minor-tailoring-effigy' as RecipeId,
  name: 'Collectible: Minor Tailoring Effigy',
  __type: 'recipe',
  result: { collectibleId: minorEffigy.id },
  requirements: [],
  tradeskillId: 'tailoring-id' as never,
  minTradeskillLevel: 5,
  maxTradeskillLevel: 5,
  tradeskillXP: 5,
  craftTime: 1500,
  tokenUnlockCost: 3,
};

const forestRuinsEncounter: EncounterContent = {
  id: 'forest-ruins' as EncounterId,
  name: 'Forest Ruins',
  __type: 'encounter',
  description: 'A dilapidated ruin.',
  levelRange: { min: 1, max: 3 },
  fights: [],
  completionRewards: [
    { kind: 'Recipe', recipeId: equipmentRecipe.id, chance: 0.25 },
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
    { type: 'sell', value: 25000, recipeId: collectibleRecipe.id, weight: 1 },
  ],
  tokenTrades: [],
} as never;

// getEntriesByType is a single generic mock shared across content types -
// route each call by the `type` argument instead of one blanket return value.
function mockEntriesByType(
  traders: unknown[] = [],
  encounters: EncounterContent[] = [forestRuinsEncounter],
): void {
  vi.mocked(getEntriesByType).mockImplementation(((type: string) => {
    if (type === 'encounter') return encounters;
    if (type === 'caravantrader') return traders;
    return [];
  }) as typeof getEntriesByType);
}

describe('Recipes Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isRecipeDiscovered', () => {
    it('returns true when foundAt is set', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: { [equipmentRecipe.id]: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(isRecipeDiscovered(equipmentRecipe.id)).toBe(true);
    });

    it('returns false when the recipe has never been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
      } as unknown as GameState);

      expect(isRecipeDiscovered(equipmentRecipe.id)).toBe(false);
    });
  });

  describe('isRecipeDropGated', () => {
    it('returns true when the recipe appears as a completion reward', () => {
      mockEntriesByType();

      expect(isRecipeDropGated(equipmentRecipe.id)).toBe(true);
    });

    it('returns false when the recipe never appears as a completion reward', () => {
      mockEntriesByType();

      expect(isRecipeDropGated(itemRecipe.id)).toBe(false);
    });

    it('returns true when a caravan trader sells the recipe', () => {
      mockEntriesByType([alekiaTrader]);

      expect(isRecipeDropGated(collectibleRecipe.id)).toBe(true);
    });

    it('returns false when no trader sells the recipe and it has no other drop source', () => {
      mockEntriesByType([alekiaTrader]);

      expect(isRecipeDropGated(itemRecipe.id)).toBe(false);
    });
  });

  describe('isRecipeCraftable', () => {
    it('is true once a drop-gated recipe has been discovered', () => {
      mockEntriesByType();
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: { [equipmentRecipe.id]: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(isRecipeCraftable(equipmentRecipe.id)).toBe(true);
    });

    it('is false for a drop-gated recipe that has not been found', () => {
      mockEntriesByType();
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
      } as unknown as GameState);

      expect(isRecipeCraftable(equipmentRecipe.id)).toBe(false);
    });

    it('is true for a recipe that never drops from a location', () => {
      mockEntriesByType();
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
      } as unknown as GameState);

      expect(isRecipeCraftable(itemRecipe.id)).toBe(true);
    });
  });

  describe('recipeDiscover', () => {
    it('adds a new discovery entry with the current timestamp', () => {
      recipeDiscover(equipmentRecipe.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        discoveredRecipes: {},
      } as unknown as GameState);

      expect(
        result.discoveredRecipes[equipmentRecipe.id].foundAt,
      ).toBeGreaterThan(0);
    });

    it('preserves the original foundAt on repeat finds', () => {
      recipeDiscover(equipmentRecipe.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        discoveredRecipes: { [equipmentRecipe.id]: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.discoveredRecipes[equipmentRecipe.id].foundAt).toBe(1000);
    });
  });

  describe('recipeUndiscover', () => {
    it('removes an existing discovery entry', () => {
      recipeUndiscover(equipmentRecipe.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        discoveredRecipes: { [equipmentRecipe.id]: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.discoveredRecipes[equipmentRecipe.id]).toBeUndefined();
    });

    it('is a no-op when the recipe was never discovered', () => {
      recipeUndiscover(equipmentRecipe.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        discoveredRecipes: {},
      } as unknown as GameState);

      expect(result.discoveredRecipes).toEqual({});
    });
  });

  describe('pruneInvalidDiscoveredRecipes', () => {
    it('keeps entries that resolve to real recipe content', () => {
      vi.mocked(getEntry).mockReturnValue(equipmentRecipe);
      const discovered: GameStateDiscoveredRecipes = {
        [equipmentRecipe.id]: { foundAt: 1000 },
      };

      expect(pruneInvalidDiscoveredRecipes(discovered)).toEqual(discovered);
    });

    it('drops entries whose recipeId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const discovered: GameStateDiscoveredRecipes = {
        [equipmentRecipe.id]: { foundAt: 1000 },
      };

      expect(pruneInvalidDiscoveredRecipes(discovered)).toEqual({});
    });
  });

  describe('recipeResultSpritesheet', () => {
    it('returns "item" for a recipe that crafts an item', () => {
      expect(recipeResultSpritesheet(itemRecipe)).toBe('item');
    });

    it('returns "equipment" for a recipe that crafts equipment', () => {
      expect(recipeResultSpritesheet(equipmentRecipe)).toBe('equipment');
    });

    it('returns "collectible" for a recipe that crafts a collectible', () => {
      expect(recipeResultSpritesheet(collectibleRecipe)).toBe('collectible');
    });
  });

  describe('recipeResultContent', () => {
    it('resolves the crafted item for an item recipe', () => {
      vi.mocked(getEntry).mockReturnValue(copperIngot);

      expect(recipeResultContent(itemRecipe)).toBe(copperIngot);
      expect(getEntry).toHaveBeenCalledWith(copperIngot.id);
    });

    it('resolves the crafted equipment for an equipment recipe', () => {
      vi.mocked(getEntry).mockReturnValue(boneHewnCloak);

      expect(recipeResultContent(equipmentRecipe)).toBe(boneHewnCloak);
      expect(getEntry).toHaveBeenCalledWith(boneHewnCloak.id);
    });

    it('resolves the crafted collectible for a collectible recipe', () => {
      vi.mocked(getEntry).mockReturnValue(minorEffigy);

      expect(recipeResultContent(collectibleRecipe)).toBe(minorEffigy);
      expect(getEntry).toHaveBeenCalledWith(minorEffigy.id);
    });
  });

  describe('recipeResultOwnedQuantity', () => {
    it('returns the material quantity for an item recipe', () => {
      vi.mocked(getMaterialQuantity).mockReturnValue(12);

      expect(recipeResultOwnedQuantity(itemRecipe)).toBe(12);
      expect(getMaterialQuantity).toHaveBeenCalledWith(copperIngot.id);
    });

    it('returns the collectible quantity for a collectible recipe', () => {
      vi.mocked(getCollectibleQuantity).mockReturnValue(3);

      expect(recipeResultOwnedQuantity(collectibleRecipe)).toBe(3);
      expect(getCollectibleQuantity).toHaveBeenCalledWith(minorEffigy.id);
    });

    it('sums armory-stored and equipped copies for an equipment recipe', () => {
      vi.mocked(getArmoryEntries).mockReturnValue([
        { content: boneHewnCloak } as never,
        { content: boneHewnCloak } as never,
        { content: { ...boneHewnCloak, id: 'other' as EquipmentId } } as never,
      ]);
      vi.mocked(partyGet).mockReturnValue([
        { equipment: {} } as never,
        { equipment: {} } as never,
      ]);
      vi.mocked(equippedItems)
        .mockReturnValueOnce([{ equipmentId: boneHewnCloak.id } as never])
        .mockReturnValueOnce([]);

      expect(recipeResultOwnedQuantity(equipmentRecipe)).toBe(3);
    });

    it('returns 0 for equipment with none stored or equipped', () => {
      vi.mocked(getArmoryEntries).mockReturnValue([]);
      vi.mocked(partyGet).mockReturnValue([]);

      expect(recipeResultOwnedQuantity(equipmentRecipe)).toBe(0);
    });
  });

  describe('recipeCanUnlockWithTokens', () => {
    beforeEach(() => {
      mockEntriesByType();
      vi.mocked(getEntry).mockReturnValue(equipmentRecipe);
    });

    it('is true for a drop-gated, undiscovered recipe the player can afford', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
        materials: {
          ['trader-token' as ItemId]: {
            quantity: equipmentRecipe.tokenUnlockCost,
            foundAt: 1,
          },
        },
      } as unknown as GameState);

      expect(recipeCanUnlockWithTokens(equipmentRecipe.id)).toBe(true);
    });

    it('is false once the recipe is already discovered', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: { [equipmentRecipe.id]: { foundAt: 1000 } },
        materials: {
          ['trader-token' as ItemId]: {
            quantity: equipmentRecipe.tokenUnlockCost,
            foundAt: 1,
          },
        },
      } as unknown as GameState);

      expect(recipeCanUnlockWithTokens(equipmentRecipe.id)).toBe(false);
    });

    it('is false for a recipe that is not drop-gated', () => {
      vi.mocked(getEntry).mockReturnValue(itemRecipe);
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
        materials: {
          ['trader-token' as ItemId]: {
            quantity: itemRecipe.tokenUnlockCost,
            foundAt: 1,
          },
        },
      } as unknown as GameState);

      expect(recipeCanUnlockWithTokens(itemRecipe.id)).toBe(false);
    });

    it('is false when the player cannot afford the token cost', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
        materials: {},
      } as unknown as GameState);

      expect(recipeCanUnlockWithTokens(equipmentRecipe.id)).toBe(false);
    });
  });

  describe('recipeUnlockWithTokens', () => {
    beforeEach(() => {
      mockEntriesByType();
      vi.mocked(getEntry).mockReturnValue(equipmentRecipe);
    });

    it('returns false and does not mutate state when unlock conditions are not met', async () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
        materials: {},
      } as unknown as GameState);

      expect(await recipeUnlockWithTokens(equipmentRecipe.id)).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('spends tokens and discovers the recipe atomically on success', async () => {
      const state = {
        discoveredRecipes: {},
        materials: {
          ['trader-token' as ItemId]: {
            quantity: equipmentRecipe.tokenUnlockCost,
            foundAt: 1,
          },
        },
      } as unknown as GameState;
      vi.mocked(gamestate).mockReturnValue(state);

      // updateGamestate is a dumb recorder here (it doesn't invoke the
      // callback itself), so the callback is captured and run manually
      // before awaiting the outer promise - mirroring the double-fire
      // regression test further down, which relies on the same
      // capture-then-invoke shape.
      const resultPromise = recipeUnlockWithTokens(equipmentRecipe.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn(state);

      expect(await resultPromise).toBe(true);
      expect(applyMaterialDelta).toHaveBeenCalledWith(
        expect.anything(),
        'trader-token',
        -equipmentRecipe.tokenUnlockCost,
      );
      expect(result.discoveredRecipes[equipmentRecipe.id].foundAt).toBeGreaterThan(0);
      expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
        'Kingdom:Museum:RecipeUnlock',
      );
    });

    it('does not double-spend tokens when two unlocks race before either commits', async () => {
      // Regression test for the rapid-click double-fire bug: updateGamestate
      // doesn't commit until an async yield later, so
      // recipeCanUnlockWithTokens (checked synchronously before that yield)
      // can pass twice against the same stale, pre-commit state if two
      // calls race in before the first one's callback actually runs.
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
        materials: {
          ['trader-token' as ItemId]: {
            quantity: equipmentRecipe.tokenUnlockCost,
            foundAt: 1,
          },
        },
      } as unknown as GameState);

      const call1 = recipeUnlockWithTokens(equipmentRecipe.id);
      const call2 = recipeUnlockWithTokens(equipmentRecipe.id);

      expect(updateGamestate).toHaveBeenCalledTimes(2);
      const [updateFn1, updateFn2] = vi
        .mocked(updateGamestate)
        .mock.calls.map((call) => call[0]);

      const initialState = {
        discoveredRecipes: {},
        materials: {
          ['trader-token' as ItemId]: {
            quantity: equipmentRecipe.tokenUnlockCost,
            foundAt: 1,
          },
        },
      } as unknown as GameState;

      // Simulates commit ordering: call1's callback commits first; call2's
      // callback then runs against that already-committed result, as it
      // would once its own updateGamestate yield resolves.
      const afterFirst = updateFn1(initialState);
      const afterSecond = updateFn2(afterFirst);

      const [result1, result2] = await Promise.all([call1, call2]);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(afterSecond).toBe(afterFirst);
      expect(
        afterFirst.discoveredRecipes[equipmentRecipe.id].foundAt,
      ).toBeGreaterThan(0);
      expect(applyMaterialDelta).toHaveBeenCalledTimes(1);
    });
  });
});
