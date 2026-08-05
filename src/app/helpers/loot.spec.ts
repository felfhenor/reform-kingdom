import { rollDroppedRewards } from '@helpers/loot';
import type {
  CollectibleId,
  DroppedReward,
  EquipmentId,
  ItemId,
  RecipeId,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

describe('Loot Helper Functions', () => {
  const goldCoinId = 'gold-coin' as ItemId;
  const cloakId = 'cloak' as EquipmentId;
  const swampClamId = 'swamp-clam' as CollectibleId;
  const boneHewnCloakRecipeId = 'bone-hewn-cloak-recipe' as RecipeId;

  describe('rollDroppedRewards', () => {
    it('should roll a quantity within range for an item drop', () => {
      const rewards: DroppedReward[] = [
        { itemId: goldCoinId, min: 3, max: 10, multiplierPerLevel: 1, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 1);
        expect(drops).toHaveLength(1);
        expect(drops[0]).toMatchObject({ itemId: goldCoinId });
        const quantity = (drops[0] as { quantity: number }).quantity;
        expect(quantity).toBeGreaterThanOrEqual(3);
        expect(quantity).toBeLessThanOrEqual(10);
      }
    });

    it('should scale the item drop range by the multiplier per level', () => {
      const rewards: DroppedReward[] = [
        { itemId: goldCoinId, min: 3, max: 10, multiplierPerLevel: 1, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 3);
        const quantity = (drops[0] as { quantity: number }).quantity;
        expect(quantity).toBeGreaterThanOrEqual(5);
        expect(quantity).toBeLessThanOrEqual(12);
      }
    });

    it('should always return an equipment drop with no quantity when chance hits', () => {
      const rewards: DroppedReward[] = [
        { equipmentId: cloakId, min: 1, max: 1, multiplierPerLevel: 0, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([{ equipmentId: cloakId }]);
      }
    });

    it('should always return a collectible drop with no quantity when chance hits', () => {
      const rewards: DroppedReward[] = [
        { collectibleId: swampClamId, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([{ collectibleId: swampClamId }]);
      }
    });

    it('should always return a recipe drop with no quantity when chance hits', () => {
      const rewards: DroppedReward[] = [
        { recipeId: boneHewnCloakRecipeId, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([{ recipeId: boneHewnCloakRecipeId }]);
      }
    });

    it('should never drop when chance is 0', () => {
      const rewards: DroppedReward[] = [
        { itemId: goldCoinId, min: 3, max: 10, multiplierPerLevel: 1, chance: 0 },
        { equipmentId: cloakId, min: 1, max: 1, multiplierPerLevel: 0, chance: 0 },
        { collectibleId: swampClamId, chance: 0 },
        { recipeId: boneHewnCloakRecipeId, chance: 0 },
      ];

      const drops = rollDroppedRewards(rewards, 1);
      expect(drops).toEqual([]);
    });

    it('should return an empty array for an empty reward list', () => {
      expect(rollDroppedRewards([], 1)).toEqual([]);
    });
  });
});
