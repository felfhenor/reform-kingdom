import { rewardDisplayOrder, rollDroppedRewards } from '@helpers/item/loot';
import type {
  CollectibleId,
  DroppedReward,
  EquipmentId,
  ItemId,
  RecipeId,
  WorkerId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { describe, expect, it } from 'vitest';

describe('Loot Helper Functions', () => {
  const goldCoinId = 'gold-coin' as ItemId;
  const cloakId = 'cloak' as EquipmentId;
  const swampClamId = 'swamp-clam' as CollectibleId;
  const boneHewnCloakRecipeId = 'bone-hewn-cloak-recipe' as RecipeId;
  const weaverNellId = 'weaver-nell' as WorkerId;

  describe('rollDroppedRewards', () => {
    it('should roll a quantity within range for an item drop', () => {
      const rewards: DroppedReward[] = [
        { kind: 'Item', itemId: goldCoinId, min: 3, max: 10, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 1);
        expect(drops).toHaveLength(1);
        expect(drops[0]).toMatchObject({ itemId: goldCoinId, kind: 'Item' });
        const quantity = (drops[0] as { quantity: number }).quantity;
        expect(quantity).toBeGreaterThanOrEqual(3);
        expect(quantity).toBeLessThanOrEqual(10);
      }
    });

    it('should scale the item drop range by level * bonusPerLevel', () => {
      const rewards: DroppedReward[] = [
        {
          kind: 'Item',
          itemId: goldCoinId,
          min: 3,
          max: 10,
          bonusPerLevel: 1,
          chance: 100,
        },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 3);
        const quantity = (drops[0] as { quantity: number }).quantity;
        expect(quantity).toBeGreaterThanOrEqual(6);
        expect(quantity).toBeLessThanOrEqual(13);
      }
    });

    it('should always return an equipment drop with no quantity when chance hits', () => {
      const rewards: DroppedReward[] = [
        { kind: 'Equipment', equipmentId: cloakId, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([{ equipmentId: cloakId, kind: 'Equipment' }]);
      }
    });

    it('should always return a collectible drop with no quantity when chance hits', () => {
      const rewards: DroppedReward[] = [
        { kind: 'Collectible', collectibleId: swampClamId, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([
          { collectibleId: swampClamId, kind: 'Collectible' },
        ]);
      }
    });

    it('should always return a recipe drop with no quantity when chance hits', () => {
      const rewards: DroppedReward[] = [
        { kind: 'Recipe', recipeId: boneHewnCloakRecipeId, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([
          { recipeId: boneHewnCloakRecipeId, kind: 'Recipe' },
        ]);
      }
    });

    it('should always return a worker drop with no quantity when chance hits', () => {
      const rewards: DroppedReward[] = [
        { kind: 'Worker', workerId: weaverNellId, chance: 100 },
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([{ workerId: weaverNellId, kind: 'Worker' }]);
      }
    });

    it('should never drop when chance is 0', () => {
      const rewards: DroppedReward[] = [
        { kind: 'Item', itemId: goldCoinId, min: 3, max: 10, chance: 0 },
        { kind: 'Equipment', equipmentId: cloakId, chance: 0 },
        { kind: 'Collectible', collectibleId: swampClamId, chance: 0 },
        { kind: 'Recipe', recipeId: boneHewnCloakRecipeId, chance: 0 },
        { kind: 'Worker', workerId: weaverNellId, chance: 0 },
      ];

      const drops = rollDroppedRewards(rewards, 1);
      expect(drops).toEqual([]);
    });

    it('should return an empty array for an empty reward list', () => {
      expect(rollDroppedRewards([], 1)).toEqual([]);
    });
  });

  describe('rewardDisplayOrder', () => {
    it('should order workers before collectibles, equipment, recipes, then items', () => {
      const item: DroppedReward = {
        kind: 'Item',
        itemId: goldCoinId,
        min: 1,
        max: 1,
        chance: 100,
      };
      const equipment: DroppedReward = {
        kind: 'Equipment',
        equipmentId: cloakId,
        chance: 100,
      };
      const collectible: DroppedReward = {
        kind: 'Collectible',
        collectibleId: swampClamId,
        chance: 100,
      };
      const recipe: DroppedReward = {
        kind: 'Recipe',
        recipeId: boneHewnCloakRecipeId,
        chance: 100,
      };
      const worker: DroppedReward = {
        kind: 'Worker',
        workerId: weaverNellId,
        chance: 100,
      };

      const sorted = sortBy(
        [item, equipment, collectible, recipe, worker],
        [rewardDisplayOrder],
      );

      expect(sorted).toEqual([worker, collectible, equipment, recipe, item]);
    });
  });
});
