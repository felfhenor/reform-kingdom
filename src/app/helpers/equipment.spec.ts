import type {
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat', () => ({
  currentCombat: vi.fn(),
}));

import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import { canModifyEquipment, equipmentStatTotals } from '@helpers/equipment';
import type { Combat } from '@interfaces';

describe('Equipment Helper Functions', () => {
  const sword: EquipmentContent = {
    id: 'sword' as EquipmentId,
    name: 'Sword',
    __type: 'equipment',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    levelRequirement: 1,
    baseStats: {
      Health: 0,
      Energy: 0,
      Luck: 0,
      Intelligence: 0,
      Strength: 5,
      Vitality: 0,
      Resistance: 0,
      Agility: 1,
    },
    statsPerLevel: {
      Health: 0,
      Energy: 0,
      Luck: 0,
      Intelligence: 0,
      Strength: 1,
      Vitality: 0,
      Resistance: 0,
      Agility: 0,
    },
    slots: ['Weapon'],
  };

  const helmet: EquipmentContent = {
    ...sword,
    id: 'helmet' as EquipmentId,
    name: 'Helmet',
    baseStats: {
      Health: 10,
      Energy: 0,
      Luck: 0,
      Intelligence: 0,
      Strength: 0,
      Vitality: 2,
      Resistance: 1,
      Agility: 0,
    },
    slots: ['Helmet'],
  };

  const emptyEquipment: EquipmentBlock = {
    Armor: undefined,
    Helmet: undefined,
    Weapon: undefined,
    Offhand: undefined,
    Ring: undefined,
    Accessory: undefined,
    Artifact: undefined,
    Ammo: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('equipmentStatTotals', () => {
    it('should return zeroed stats when nothing is equipped', () => {
      expect(equipmentStatTotals(emptyEquipment)).toEqual({
        Health: 0,
        Energy: 0,
        Luck: 0,
        Intelligence: 0,
        Strength: 0,
        Vitality: 0,
        Resistance: 0,
        Agility: 0,
      });
      expect(getEntry).not.toHaveBeenCalled();
    });

    it('should sum baseStats across all equipped slots, ignoring statsPerLevel', () => {
      vi.mocked(getEntry).mockImplementation((id) =>
        (id === 'sword' ? sword : helmet) as never,
      );

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: { equipmentId: 'sword' as EquipmentId },
        Helmet: { equipmentId: 'helmet' as EquipmentId },
      });

      expect(totals).toEqual({
        Health: 10,
        Energy: 0,
        Luck: 0,
        Intelligence: 0,
        Strength: 5,
        Vitality: 2,
        Resistance: 1,
        Agility: 1,
      });
    });

    it('should ignore slots whose equipment content cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: { equipmentId: 'missing' as EquipmentId },
      });

      expect(totals).toEqual({
        Health: 0,
        Energy: 0,
        Luck: 0,
        Intelligence: 0,
        Strength: 0,
        Vitality: 0,
        Resistance: 0,
        Agility: 0,
      });
    });
  });

  describe('canModifyEquipment', () => {
    it('allows equipment changes when there is no active combat', () => {
      vi.mocked(currentCombat).mockReturnValue(undefined);

      expect(canModifyEquipment()).toBe(true);
    });

    it('blocks equipment changes while a combat is active', () => {
      vi.mocked(currentCombat).mockReturnValue({} as Combat);

      expect(canModifyEquipment()).toBe(false);
    });
  });
});
