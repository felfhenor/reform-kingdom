import type { EquipmentContent, EquipmentId, GameState } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { armoryAdd, armoryGet, pruneInvalidArmoryItems } from '@helpers/armory';
import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';

describe('Armory Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('armoryGet', () => {
    it('returns the armory list from state', () => {
      const armory = [{ equipmentId: 'sword' as EquipmentId }];
      vi.mocked(gamestate).mockReturnValue({ armory } as unknown as GameState);

      expect(armoryGet()).toBe(armory);
    });
  });

  describe('armoryAdd', () => {
    it('appends the equipment item to the armory', () => {
      armoryAdd('sword' as EquipmentId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [{ equipmentId: 'shield' as EquipmentId }],
      } as unknown as GameState);

      expect(result.armory).toEqual([
        { equipmentId: 'shield' },
        { equipmentId: 'sword' },
      ]);
    });

    it('appends multiple copies when given a quantity', () => {
      armoryAdd('sword' as EquipmentId, 3);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({ armory: [] } as unknown as GameState);

      expect(result.armory).toEqual([
        { equipmentId: 'sword' },
        { equipmentId: 'sword' },
        { equipmentId: 'sword' },
      ]);
    });

    it('does nothing for a zero or negative quantity', () => {
      armoryAdd('sword' as EquipmentId, 0);
      armoryAdd('sword' as EquipmentId, -1);

      expect(updateGamestate).not.toHaveBeenCalled();
    });
  });

  describe('pruneInvalidArmoryItems', () => {
    it('keeps entries that resolve to real equipment content', () => {
      vi.mocked(getEntry).mockReturnValue({ id: 'sword' } as EquipmentContent);
      const armory = [{ equipmentId: 'sword' as EquipmentId }];

      expect(pruneInvalidArmoryItems(armory)).toEqual(armory);
    });

    it('drops entries whose equipmentId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const armory = [{ equipmentId: 'sword' as EquipmentId }];

      expect(pruneInvalidArmoryItems(armory)).toEqual([]);
    });

    it('prunes only the invalid entries out of a mixed list', () => {
      vi.mocked(getEntry).mockImplementation((id) =>
        (id === 'sword' ? { id: 'sword' } : undefined) as never,
      );
      const armory = [
        { equipmentId: 'sword' as EquipmentId },
        { equipmentId: 'stale-gear' as EquipmentId },
      ];

      expect(pruneInvalidArmoryItems(armory)).toEqual([
        { equipmentId: 'sword' },
      ]);
    });

    it('returns an empty array for an empty input', () => {
      expect(pruneInvalidArmoryItems([])).toEqual([]);
    });
  });
});
