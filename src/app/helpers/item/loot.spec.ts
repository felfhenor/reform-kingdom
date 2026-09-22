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

vi.mock('@helpers/hero/global-effects', () => ({
  globalEffectSums: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/hero/global-effect-state', () => ({
  recomputeGlobalEffectSums: vi.fn(),
}));

import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { globalEffectSums } from '@helpers/hero/global-effects';
import {
  applyResolvedDropToState,
  combatItemDropRateBoost,
  rewardDisplayOrder,
  rollDroppedRewards,
} from '@helpers/item/loot';
import type {
  CollectibleId,
  DroppedReward,
  EquipmentId,
  EquipmentItemId,
  GameState,
  GlobalEffectSums,
  ItemId,
  RecipeContent,
  RecipeId,
  ResolvedDrop,
  TradeskillId,
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
        ensureDroppedReward({
          itemId: goldCoinId,
          min: 3,
          max: 10,
          chance: 100,
        }),
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
        ensureDroppedReward({
          itemId: goldCoinId,
          min: 3,
          max: 10,
          bonusPerLevel: 1,
          chance: 100,
        }),
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
        ensureDroppedReward({
          equipmentId: cloakId,
          chance: 100,
        }),
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([{ equipmentId: cloakId, kind: 'Equipment' }]);
      }
    });

    it('should always return a collectible drop with no quantity when chance hits', () => {
      const rewards: DroppedReward[] = [
        ensureDroppedReward({
          collectibleId: swampClamId,
          chance: 100,
        }),
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
        ensureDroppedReward({
          recipeId: boneHewnCloakRecipeId,
          chance: 100,
        }),
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([
          { recipeId: boneHewnCloakRecipeId, kind: 'Recipe' },
        ]);
      }
    });

    it('should still allow a recipe drop when its content cannot be resolved', () => {
      vi.mocked(getEntry).mockReturnValueOnce(undefined);
      const rewards: DroppedReward[] = [
        ensureDroppedReward({ recipeId: boneHewnCloakRecipeId, chance: 100 }),
      ];

      const drops = rollDroppedRewards(rewards, 5, 0, {} as GameState);

      expect(drops).toEqual([
        { recipeId: boneHewnCloakRecipeId, kind: 'Recipe' },
      ]);
    });

    it('should filter out a recipe drop that is exclusively sold by a town', () => {
      vi.mocked(getEntriesByType).mockReturnValueOnce([
        { crafting: { uniqueRecipeIds: [boneHewnCloakRecipeId] } },
      ] as never);
      const rewards: DroppedReward[] = [
        ensureDroppedReward({ recipeId: boneHewnCloakRecipeId, chance: 100 }),
      ];

      const drops = rollDroppedRewards(rewards, 5, 0, {} as GameState);

      expect(drops).toEqual([]);
    });

    it('should filter out a recipe drop when the tradeskill level requirement is not met', () => {
      const tradeskillId = 'artificing' as TradeskillId;
      vi.mocked(getEntry).mockReturnValueOnce({
        tradeskillId,
        minTradeskillLevel: 5,
      } as RecipeContent);
      const state = {
        tradeskills: { [tradeskillId]: { level: 4 } },
      } as unknown as GameState;
      const rewards: DroppedReward[] = [
        ensureDroppedReward({ recipeId: boneHewnCloakRecipeId, chance: 100 }),
      ];

      const drops = rollDroppedRewards(rewards, 5, 0, state);

      expect(drops).toEqual([]);
    });

    it('should allow a recipe drop once the tradeskill level requirement is met', () => {
      const tradeskillId = 'artificing' as TradeskillId;
      vi.mocked(getEntry).mockReturnValueOnce({
        tradeskillId,
        minTradeskillLevel: 5,
      } as RecipeContent);
      const state = {
        tradeskills: { [tradeskillId]: { level: 5 } },
      } as unknown as GameState;
      const rewards: DroppedReward[] = [
        ensureDroppedReward({ recipeId: boneHewnCloakRecipeId, chance: 100 }),
      ];

      const drops = rollDroppedRewards(rewards, 5, 0, state);

      expect(drops).toEqual([
        { recipeId: boneHewnCloakRecipeId, kind: 'Recipe' },
      ]);
    });

    it('should always return a worker drop with no quantity when chance hits', () => {
      const rewards: DroppedReward[] = [
        ensureDroppedReward({
          workerId: weaverNellId,
          chance: 100,
        }),
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5);
        expect(drops).toEqual([{ workerId: weaverNellId, kind: 'Worker' }]);
      }
    });

    it('should never drop when chance is 0', () => {
      const rewards: DroppedReward[] = [
        ensureDroppedReward({
          itemId: goldCoinId,
          min: 3,
          max: 10,
          chance: 0,
        }),
        ensureDroppedReward({
          equipmentId: cloakId,
          chance: 0,
        }),
        ensureDroppedReward({
          collectibleId: swampClamId,
          chance: 0,
        }),
        ensureDroppedReward({
          recipeId: boneHewnCloakRecipeId,
          chance: 0,
        }),
        ensureDroppedReward({
          workerId: weaverNellId,
          chance: 0,
        }),
      ];

      const drops = rollDroppedRewards(rewards, 1);
      expect(drops).toEqual([]);
    });

    it('should return an empty array for an empty reward list', () => {
      expect(rollDroppedRewards([], 1)).toEqual([]);
    });

    it('should add bonusChancePercent to the drop chance before rolling', () => {
      const rewards: DroppedReward[] = [
        ensureDroppedReward({
          equipmentId: cloakId,
          chance: 0,
        }),
      ];

      const drops = rollDroppedRewards(rewards, 5, 100);
      expect(drops).toEqual([{ equipmentId: cloakId, kind: 'Equipment' }]);
    });

    it('should clamp a boosted chance at 100', () => {
      const rewards: DroppedReward[] = [
        ensureDroppedReward({
          equipmentId: cloakId,
          chance: 50,
        }),
      ];

      for (let i = 0; i < 50; i++) {
        const drops = rollDroppedRewards(rewards, 5, 500);
        expect(drops).toEqual([{ equipmentId: cloakId, kind: 'Equipment' }]);
      }
    });
  });

  describe('combatItemDropRateBoost', () => {
    it('reads the flat percent from the global effect sums cache', () => {
      vi.mocked(globalEffectSums).mockReturnValue({
        combatItemDropRateBoost: 9,
      } as GlobalEffectSums);

      expect(combatItemDropRateBoost()).toBe(9);
    });

    it('returns 0 when nothing is active/owned', () => {
      vi.mocked(globalEffectSums).mockReturnValue({
        combatItemDropRateBoost: 0,
      } as GlobalEffectSums);

      expect(combatItemDropRateBoost()).toBe(0);
    });
  });

  describe('rewardDisplayOrder', () => {
    it('should order workers before collectibles, equipment, recipes, then items', () => {
      const item: DroppedReward = ensureDroppedReward({
        itemId: goldCoinId,
        min: 1,
        max: 1,
        chance: 100,
      });
      const equipment: DroppedReward = ensureDroppedReward({
        equipmentId: cloakId,
        chance: 100,
      });
      const collectible: DroppedReward = ensureDroppedReward({
        collectibleId: swampClamId,
        chance: 100,
      });
      const recipe: DroppedReward = ensureDroppedReward({
        recipeId: boneHewnCloakRecipeId,
        chance: 100,
      });
      const worker: DroppedReward = ensureDroppedReward({
        workerId: weaverNellId,
        chance: 100,
      });

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
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
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

    it("preserves an equipment drop's original discovery date on a repeat find", () => {
      const state = fakeState();
      state.discoveredEquipment[cloakId] = { foundAt: 1000 };
      const drop: ResolvedDrop = { kind: 'Equipment', equipmentId: cloakId };

      applyResolvedDropToState(state, drop);

      expect(state.discoveredEquipment[cloakId]?.foundAt).toBe(1000);
    });

    it('still admits an equipment drop past the strict 50-item cap, up to the 125% overflow allowance', () => {
      const state = fakeState();
      state.armory = Array.from({ length: 55 }, () => ({
        id: 'existing-item' as EquipmentItemId,
        equipmentId: 'shield' as EquipmentId,
        infusedItemIds: [],
        affixIds: [],
      }));
      const drop: ResolvedDrop = { kind: 'Equipment', equipmentId: cloakId };

      applyResolvedDropToState(state, drop);

      expect(state.armory).toHaveLength(56);
    });

    it('rejects an equipment drop once the 125% overflow allowance is exhausted', () => {
      const state = fakeState();
      state.armory = Array.from({ length: 62 }, () => ({
        id: 'existing-item' as EquipmentItemId,
        equipmentId: 'shield' as EquipmentId,
        infusedItemIds: [],
        affixIds: [],
      }));
      const drop: ResolvedDrop = { kind: 'Equipment', equipmentId: cloakId };

      applyResolvedDropToState(state, drop);

      expect(state.armory).toHaveLength(62);
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

      expect(
        state.discoveredRecipes[boneHewnCloakRecipeId]?.foundAt,
      ).toBeDefined();
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
