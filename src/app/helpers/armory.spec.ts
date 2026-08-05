import { defaultStats } from '@helpers/defaults';
import type { EquipmentContent, EquipmentId, GameState } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import {
  armoryAdd,
  armoryGet,
  filterArmoryEntries,
  getArmoryEntries,
  isEquipmentDiscovered,
  pruneInvalidArmoryItems,
  pruneInvalidDiscoveredEquipment,
} from '@helpers/armory';
import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';

const sword: EquipmentContent = {
  id: 'sword' as EquipmentId,
  name: 'Sword',
  __type: 'equipment',
  description: 'A sharp blade.',
  sprite: '0000',
  rarity: 'Common',
  levelRequirement: 1,
  baseStats: defaultStats(),
  slots: ['Weapon'],
  requiredJobIds: [],
};

const shield: EquipmentContent = {
  ...sword,
  id: 'shield' as EquipmentId,
  name: 'Shield',
  description: 'A sturdy protective shield.',
  rarity: 'Rare',
  slots: ['Offhand'],
};

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
        discoveredEquipment: {},
      } as unknown as GameState);

      expect(result.armory).toEqual([
        { equipmentId: 'shield' },
        { equipmentId: 'sword' },
      ]);
    });

    it('appends multiple copies when given a quantity', () => {
      armoryAdd('sword' as EquipmentId, 3);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [],
        discoveredEquipment: {},
      } as unknown as GameState);

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

    it('marks the equipment as permanently discovered', () => {
      armoryAdd('sword' as EquipmentId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [],
        discoveredEquipment: {},
      } as unknown as GameState);

      expect(result.discoveredEquipment['sword'].foundAt).toBeGreaterThan(0);
    });

    it('preserves the original discovery timestamp on repeat finds', () => {
      armoryAdd('sword' as EquipmentId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [],
        discoveredEquipment: { sword: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.discoveredEquipment['sword']).toEqual({ foundAt: 1000 });
    });
  });

  describe('isEquipmentDiscovered', () => {
    it('returns true once the equipment has ever been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredEquipment: { sword: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(isEquipmentDiscovered('sword' as EquipmentId)).toBe(true);
    });

    it('returns true even if the equipment is no longer in the armory', () => {
      vi.mocked(gamestate).mockReturnValue({
        armory: [],
        discoveredEquipment: { sword: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(isEquipmentDiscovered('sword' as EquipmentId)).toBe(true);
    });

    it('returns false when the equipment has never been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredEquipment: {},
      } as unknown as GameState);

      expect(isEquipmentDiscovered('sword' as EquipmentId)).toBe(false);
    });
  });

  describe('pruneInvalidDiscoveredEquipment', () => {
    it('keeps entries that resolve to real equipment content', () => {
      vi.mocked(getEntry).mockReturnValue({ id: 'sword' } as EquipmentContent);
      const discovered = { ['sword' as EquipmentId]: { foundAt: 1000 } };

      expect(pruneInvalidDiscoveredEquipment(discovered)).toEqual(discovered);
    });

    it('drops entries whose equipmentId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const discovered = {
        ['stale-gear' as EquipmentId]: { foundAt: 1000 },
      };

      expect(pruneInvalidDiscoveredEquipment(discovered)).toEqual({});
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

  describe('getArmoryEntries', () => {
    it('returns one entry per owned item, without merging duplicates, sorted by rarity then name', () => {
      vi.mocked(gamestate).mockReturnValue({
        armory: [
          { equipmentId: sword.id },
          { equipmentId: shield.id },
          { equipmentId: sword.id },
        ],
      } as unknown as GameState);
      vi.mocked(getEntry).mockImplementation((id) =>
        (id === sword.id ? sword : shield) as never,
      );

      expect(getArmoryEntries()).toEqual([shield, sword, sword]);
    });

    it('excludes entries with no matching content entry', () => {
      vi.mocked(gamestate).mockReturnValue({
        armory: [{ equipmentId: sword.id }],
      } as unknown as GameState);
      vi.mocked(getEntry).mockReturnValue(undefined);

      expect(getArmoryEntries()).toEqual([]);
    });

    it('returns an empty array when the armory is empty', () => {
      vi.mocked(gamestate).mockReturnValue({
        armory: [],
      } as unknown as GameState);

      expect(getArmoryEntries()).toEqual([]);
    });
  });

  describe('filterArmoryEntries', () => {
    const entries = [sword, shield];

    it('returns every entry when the search text is empty', () => {
      expect(filterArmoryEntries(entries, '   ')).toEqual(entries);
    });

    it('filters by equipment name, case-insensitively', () => {
      expect(filterArmoryEntries(entries, 'SWORD')).toEqual([sword]);
    });

    it('filters by equipment description', () => {
      expect(filterArmoryEntries(entries, 'protective')).toEqual([shield]);
    });

    it('returns an empty array when nothing matches', () => {
      expect(filterArmoryEntries(entries, 'nonexistent')).toEqual([]);
    });
  });
});
