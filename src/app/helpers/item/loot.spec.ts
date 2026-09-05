import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/equipment', () => ({
  newEquipmentItem: vi.fn((equipmentId: string) => ({
    id: 'rolled-equipment-item',
    equipmentId,
    infusedItemIds: [],
    affixIds: [],
  })),
}));

vi.mock('@helpers/worker/worker-progression', () => ({
  defaultWorkerState: vi.fn(() => ({
    level: 1,
    xp: { current: 0, maximum: 10 },
    location: { mapName: '', x: 0, y: 0 },
    status: { kind: 'AtDuchy' },
    assignment: null,
  })),
}));

import {
  applyResolvedDropToState,
  rewardDisplayOrder,
  rollDroppedRewards,
} from '@helpers/item/loot';
import type {
  CollectibleId,
  DroppedReward,
  EquipmentId,
  GameState,
  ItemId,
  RecipeId,
  ResolvedDrop,
  WorkerId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

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

  describe('applyResolvedDropToState', () => {
    function fakeState(): GameState {
      return {
        materials: {},
        discoveredMaterials: {},
        armory: [],
        discoveredEquipment: {},
        collectibles: {},
        discoveredRecipes: {},
        discoveredWorkers: {},
        workers: {},
      } as unknown as GameState;
    }

    it('adds an item drop as a material delta', () => {
      const state = fakeState();
      const drop: ResolvedDrop = {
        kind: 'Item',
        itemId: goldCoinId,
        quantity: 5,
      };

      applyResolvedDropToState(state, drop);

      expect(state.materials[goldCoinId]?.quantity).toBe(5);
    });

    it('adds an equipment drop to the armory and marks it discovered', () => {
      const state = fakeState();
      const drop: ResolvedDrop = { kind: 'Equipment', equipmentId: cloakId };

      applyResolvedDropToState(state, drop);

      expect(state.armory).toEqual([
        {
          id: 'rolled-equipment-item',
          equipmentId: cloakId,
          infusedItemIds: [],
          affixIds: [],
        },
      ]);
      expect(state.discoveredEquipment[cloakId]?.foundAt).toBeDefined();
    });

    it('preserves an equipment drop\'s original discovery date on a repeat find', () => {
      const state = fakeState();
      state.discoveredEquipment[cloakId] = { foundAt: 1000 };
      const drop: ResolvedDrop = { kind: 'Equipment', equipmentId: cloakId };

      applyResolvedDropToState(state, drop);

      expect(state.discoveredEquipment[cloakId]?.foundAt).toBe(1000);
    });

    it('increments an existing collectible quantity and keeps its discovery date', () => {
      const state = fakeState();
      state.collectibles[swampClamId] = { quantity: 2, foundAt: 1000 };
      const drop: ResolvedDrop = {
        kind: 'Collectible',
        collectibleId: swampClamId,
      };

      applyResolvedDropToState(state, drop);

      expect(state.collectibles[swampClamId]).toEqual({
        quantity: 3,
        foundAt: 1000,
      });
    });

    it('discovers a recipe', () => {
      const state = fakeState();
      const drop: ResolvedDrop = {
        kind: 'Recipe',
        recipeId: boneHewnCloakRecipeId,
      };

      applyResolvedDropToState(state, drop);

      expect(state.discoveredRecipes[boneHewnCloakRecipeId]?.foundAt).toBeDefined();
    });

    it('rescues a worker and seeds its default state', () => {
      const state = fakeState();
      const drop: ResolvedDrop = { kind: 'Worker', workerId: weaverNellId };

      applyResolvedDropToState(state, drop);

      expect(state.discoveredWorkers[weaverNellId]?.foundAt).toBeDefined();
      expect(state.workers[weaverNellId]).toEqual({
        level: 1,
        xp: { current: 0, maximum: 10 },
        location: { mapName: '', x: 0, y: 0 },
        status: { kind: 'AtDuchy' },
        assignment: null,
      });
    });

    it('does not re-rescue an already-discovered worker', () => {
      const state = fakeState();
      state.discoveredWorkers[weaverNellId] = { foundAt: 1000 };
      state.workers[weaverNellId] = 'already-progressed' as never;
      const drop: ResolvedDrop = { kind: 'Worker', workerId: weaverNellId };

      applyResolvedDropToState(state, drop);

      expect(state.workers[weaverNellId]).toBe('already-progressed');
    });
  });
});
