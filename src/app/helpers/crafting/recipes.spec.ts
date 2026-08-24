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
  getRecipeFoundAtNode,
  isRecipeCraftable,
  isRecipeDiscovered,
  isRecipeDropGated,
  pruneInvalidDiscoveredRecipes,
  recipeDiscover,
  recipeResultContent,
  recipeResultOwnedQuantity,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import { partyGet } from '@helpers/hero/party';
import { getCollectibleQuantity } from '@helpers/item/collectibles';
import { equippedItems } from '@helpers/item/equipment';
import { getMaterialQuantity } from '@helpers/item/materials';
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
};

const forestRuinsEncounter: EncounterContent = {
  id: 'forest-ruins' as EncounterId,
  name: 'Forest Ruins',
  __type: 'encounter',
  description: 'A dilapidated ruin.',
  levelRange: { min: 1, max: 3 },
  fights: [],
  completionRewards: [{ recipeId: equipmentRecipe.id, chance: 0.25 }],
};

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
      vi.mocked(getEntriesByType).mockReturnValue([forestRuinsEncounter]);

      expect(isRecipeDropGated(equipmentRecipe.id)).toBe(true);
    });

    it('returns false when the recipe never appears as a completion reward', () => {
      vi.mocked(getEntriesByType).mockReturnValue([forestRuinsEncounter]);

      expect(isRecipeDropGated(itemRecipe.id)).toBe(false);
    });
  });

  describe('isRecipeCraftable', () => {
    it('is true once a drop-gated recipe has been discovered', () => {
      vi.mocked(getEntriesByType).mockReturnValue([forestRuinsEncounter]);
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: { [equipmentRecipe.id]: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(isRecipeCraftable(equipmentRecipe.id)).toBe(true);
    });

    it('is false for a drop-gated recipe that has not been found', () => {
      vi.mocked(getEntriesByType).mockReturnValue([forestRuinsEncounter]);
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
      } as unknown as GameState);

      expect(isRecipeCraftable(equipmentRecipe.id)).toBe(false);
    });

    it('is true for a recipe that never drops from a location', () => {
      vi.mocked(getEntriesByType).mockReturnValue([forestRuinsEncounter]);
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
      } as unknown as GameState);

      expect(isRecipeCraftable(itemRecipe.id)).toBe(true);
    });
  });

  describe('getRecipeFoundAtNode', () => {
    it('returns the node the recipe was found in', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {
          [equipmentRecipe.id]: { foundAt: 1000, foundAtNode: 'Carrina' },
        },
      } as unknown as GameState);

      expect(getRecipeFoundAtNode(equipmentRecipe.id)).toBe('Carrina');
    });

    it('returns undefined when the recipe has never been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredRecipes: {},
      } as unknown as GameState);

      expect(getRecipeFoundAtNode(equipmentRecipe.id)).toBeUndefined();
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

    it('records the node it was found in', () => {
      recipeDiscover(equipmentRecipe.id, 'Carrina');

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        discoveredRecipes: {},
      } as unknown as GameState);

      expect(result.discoveredRecipes[equipmentRecipe.id].foundAtNode).toBe(
        'Carrina',
      );
    });

    it('preserves the original found-at node on repeat finds', () => {
      recipeDiscover(equipmentRecipe.id, 'Craggledmire');

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        discoveredRecipes: {
          [equipmentRecipe.id]: { foundAt: 1000, foundAtNode: 'Carrina' },
        },
      } as unknown as GameState);

      expect(result.discoveredRecipes[equipmentRecipe.id].foundAtNode).toBe(
        'Carrina',
      );
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
});
