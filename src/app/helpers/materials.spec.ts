import type { GameState, GameStateMaterials, ItemContent, MaterialId } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import {
  addMaterial,
  applyMaterialDelta,
  gainGold,
  getGoldQuantity,
  getMaterialQuantity,
  goldCoinId as resolveGoldCoinId,
  grantStartingGold,
  isMaterialDiscovered,
  pruneInvalidMaterials,
  removeMaterial,
  spendGold,
} from '@helpers/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';

describe('Material Helper Functions', () => {
  const goldCoinId = 'gold-coin' as MaterialId;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('goldCoinId', () => {
    it("resolves the item id of the 'Gold Coin' content entry", () => {
      vi.mocked(getEntry).mockReturnValue({ id: goldCoinId } as ItemContent);

      expect(resolveGoldCoinId()).toBe(goldCoinId);
      expect(getEntry).toHaveBeenCalledWith('Gold Coin');
    });
  });

  describe('applyMaterialDelta', () => {
    it('adds a positive delta to an existing quantity, preserving foundAt', () => {
      const state = {
        materials: { [goldCoinId]: { quantity: 5, foundAt: 1000 } },
      } as unknown as GameState;

      applyMaterialDelta(state, goldCoinId, 10);

      expect(state.materials[goldCoinId]).toEqual({
        quantity: 15,
        foundAt: 1000,
      });
    });

    it('creates the entry with a fresh foundAt when the material is new', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1234);
      const state = { materials: {} } as unknown as GameState;

      applyMaterialDelta(state, goldCoinId, 3);

      expect(state.materials[goldCoinId]).toEqual({
        quantity: 3,
        foundAt: 1234,
      });

      vi.restoreAllMocks();
    });

    it('subtracts a negative delta, clamping at 0 and dropping the entry', () => {
      const state = {
        materials: { [goldCoinId]: { quantity: 10, foundAt: 1000 } },
      } as unknown as GameState;

      applyMaterialDelta(state, goldCoinId, -100);

      expect(state.materials[goldCoinId]).toBeUndefined();
    });

    it('leaves a remaining positive quantity in place when partially subtracted', () => {
      const state = {
        materials: { [goldCoinId]: { quantity: 10, foundAt: 1000 } },
      } as unknown as GameState;

      applyMaterialDelta(state, goldCoinId, -4);

      expect(state.materials[goldCoinId]).toEqual({
        quantity: 6,
        foundAt: 1000,
      });
    });
  });

  describe('getGoldQuantity/gainGold/spendGold', () => {
    beforeEach(() => {
      vi.mocked(getEntry).mockReturnValue({ id: goldCoinId } as ItemContent);
    });

    it('getGoldQuantity reads the gold material quantity', () => {
      vi.mocked(gamestate).mockReturnValue({
        materials: { [goldCoinId]: { quantity: 42, foundAt: 1000 } },
      } as unknown as GameState);

      expect(getGoldQuantity()).toBe(42);
    });

    it('gainGold adds to the gold quantity in place', () => {
      const state = {
        materials: { [goldCoinId]: { quantity: 5, foundAt: 1000 } },
      } as unknown as GameState;

      gainGold(state, 10);

      expect(state.materials[goldCoinId]).toEqual({
        quantity: 15,
        foundAt: 1000,
      });
    });

    it('spendGold subtracts from the gold quantity in place, clamping at 0', () => {
      const state = {
        materials: { [goldCoinId]: { quantity: 5, foundAt: 1000 } },
      } as unknown as GameState;

      spendGold(state, 100);

      expect(state.materials[goldCoinId]).toBeUndefined();
    });
  });

  describe('grantStartingGold', () => {
    beforeEach(() => {
      vi.mocked(getEntry).mockReturnValue({ id: goldCoinId } as ItemContent);
    });

    it('grants 100 gold on a fresh state with no existing gold', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1234);
      const state = { materials: {} } as unknown as GameState;

      grantStartingGold(state);

      expect(state.materials[goldCoinId]).toEqual({
        quantity: 100,
        foundAt: 1234,
      });

      vi.restoreAllMocks();
    });

    it('adds 100 gold on top of any existing gold quantity', () => {
      const state = {
        materials: { [goldCoinId]: { quantity: 5, foundAt: 1000 } },
      } as unknown as GameState;

      grantStartingGold(state);

      expect(state.materials[goldCoinId]).toEqual({
        quantity: 105,
        foundAt: 1000,
      });
    });
  });

  describe('getMaterialQuantity', () => {
    it('should return the stored quantity for a known material', () => {
      vi.mocked(gamestate).mockReturnValue({
        materials: { [goldCoinId]: { quantity: 5, foundAt: 1000 } },
      } as unknown as GameState);

      expect(getMaterialQuantity(goldCoinId)).toBe(5);
    });

    it('should return 0 for a material that has never been added', () => {
      vi.mocked(gamestate).mockReturnValue({
        materials: {},
      } as unknown as GameState);

      expect(getMaterialQuantity(goldCoinId)).toBe(0);
    });
  });

  describe('isMaterialDiscovered', () => {
    it('should return true for a material with a foundAt timestamp', () => {
      vi.mocked(gamestate).mockReturnValue({
        materials: { [goldCoinId]: { quantity: 5, foundAt: 1000 } },
      } as unknown as GameState);

      expect(isMaterialDiscovered(goldCoinId)).toBe(true);
    });

    it('should return false for a material that has never been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        materials: {},
      } as unknown as GameState);

      expect(isMaterialDiscovered(goldCoinId)).toBe(false);
    });
  });

  describe('addMaterial', () => {
    it('should add to an existing quantity', () => {
      addMaterial(goldCoinId, 10);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [goldCoinId]: { quantity: 5, foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.materials[goldCoinId]).toEqual({
        quantity: 15,
        foundAt: 1000,
      });
    });

    it('should preserve the original foundAt when topping up an existing material', () => {
      vi.spyOn(Date, 'now').mockReturnValue(9999);

      addMaterial(goldCoinId, 10);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [goldCoinId]: { quantity: 5, foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.materials[goldCoinId].foundAt).toBe(1000);

      vi.restoreAllMocks();
    });

    it('should create the entry when the material is new', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1234);

      addMaterial(goldCoinId, 3);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({ materials: {} } as unknown as GameState);

      expect(result.materials[goldCoinId]).toEqual({
        quantity: 3,
        foundAt: 1234,
      });

      vi.restoreAllMocks();
    });

    it('should stamp a fresh foundAt when a fully-depleted material is found again', () => {
      vi.spyOn(Date, 'now').mockReturnValue(5000);

      addMaterial(goldCoinId, 1);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({ materials: {} } as unknown as GameState);

      expect(result.materials[goldCoinId]).toEqual({
        quantity: 1,
        foundAt: 5000,
      });

      vi.restoreAllMocks();
    });
  });

  describe('pruneInvalidMaterials', () => {
    it('keeps entries that resolve to real content', () => {
      vi.mocked(getEntry).mockReturnValue({ id: goldCoinId } as ItemContent);
      const materials: GameStateMaterials = {
        [goldCoinId]: { quantity: 5, foundAt: 1000 },
      };

      expect(pruneInvalidMaterials(materials)).toEqual(materials);
    });

    it('drops entries whose id no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const materials: GameStateMaterials = {
        [goldCoinId]: { quantity: 5, foundAt: 1000 },
      };

      expect(pruneInvalidMaterials(materials)).toEqual({});
    });

    it('prunes only the invalid entries out of a mixed set', () => {
      const staleId = 'stale-material' as MaterialId;
      vi.mocked(getEntry).mockImplementation((id) =>
        (id === goldCoinId ? { id: goldCoinId } : undefined) as never,
      );
      const materials: GameStateMaterials = {
        [goldCoinId]: { quantity: 5, foundAt: 1000 },
        [staleId]: { quantity: 2, foundAt: 2000 },
      };

      expect(pruneInvalidMaterials(materials)).toEqual({
        [goldCoinId]: { quantity: 5, foundAt: 1000 },
      });
    });

    it('returns an empty object for an empty input', () => {
      expect(pruneInvalidMaterials({})).toEqual({});
    });
  });

  describe('removeMaterial', () => {
    it('should subtract from the existing quantity while preserving foundAt', () => {
      removeMaterial(goldCoinId, 4);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [goldCoinId]: { quantity: 10, foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.materials[goldCoinId]).toEqual({
        quantity: 6,
        foundAt: 1000,
      });
    });

    it('should remove the entry entirely once it reaches 0', () => {
      removeMaterial(goldCoinId, 10);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [goldCoinId]: { quantity: 10, foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.materials[goldCoinId]).toBeUndefined();
    });

    it('should not go negative when removing more than is available', () => {
      removeMaterial(goldCoinId, 100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [goldCoinId]: { quantity: 10, foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.materials[goldCoinId]).toBeUndefined();
    });
  });
});
