import type { GameState, MaterialId } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import {
  addMaterial,
  getMaterialQuantity,
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
        materials: { [goldCoinId]: { quantity: 5 } },
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

  describe('addMaterial', () => {
    it('should add to an existing quantity', () => {
      addMaterial(goldCoinId, 10);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [goldCoinId]: { quantity: 5 } },
      } as unknown as GameState);

      expect(result.materials[goldCoinId]).toEqual({ quantity: 15 });
    });

    it('should create the entry when the material is new', () => {
      addMaterial(goldCoinId, 3);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({ materials: {} } as unknown as GameState);

      expect(result.materials[goldCoinId]).toEqual({ quantity: 3 });
    });
  });

  describe('removeMaterial', () => {
    it('should subtract from the existing quantity', () => {
      removeMaterial(goldCoinId, 4);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [goldCoinId]: { quantity: 10 } },
      } as unknown as GameState);

      expect(result.materials[goldCoinId]).toEqual({ quantity: 6 });
    });

    it('should remove the entry entirely once it reaches 0', () => {
      removeMaterial(goldCoinId, 10);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [goldCoinId]: { quantity: 10 } },
      } as unknown as GameState);

      expect(result.materials[goldCoinId]).toBeUndefined();
    });

    it('should not go negative when removing more than is available', () => {
      removeMaterial(goldCoinId, 100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [goldCoinId]: { quantity: 10 } },
      } as unknown as GameState);

      expect(result.materials[goldCoinId]).toBeUndefined();
    });
  });
});
