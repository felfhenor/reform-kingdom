import type { GameState, MaterialId } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import {
  addMaterial,
  getMaterialQuantity,
  isMaterialDiscovered,
  removeMaterial,
} from '@helpers/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';

describe('Material Helper Functions', () => {
  const goldCoinId = 'gold-coin' as MaterialId;

  beforeEach(() => {
    vi.clearAllMocks();
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
