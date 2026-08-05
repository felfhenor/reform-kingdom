import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  JobContent,
  JobId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat', () => ({
  currentCombat: vi.fn(),
}));

import { armoryGet } from '@helpers/armory';
import { currentCombat } from '@helpers/combat';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  canEquipItem,
  canModifyEquipment,
  equipmentAvailableForSlot,
  equipmentStatTotals,
  equippedItems,
  isSlotAvailableForJob,
  slotsHoldingEquipment,
} from '@helpers/equipment';
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

  const spear: EquipmentContent = {
    ...sword,
    id: 'spear' as EquipmentId,
    name: 'Copper Spear',
    baseStats: {
      Health: 0,
      Energy: 0,
      Luck: 0,
      Intelligence: 0,
      Strength: 3,
      Vitality: 0,
      Resistance: 0,
      Agility: 0,
    },
    slots: ['Weapon', 'Offhand'],
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

    it('should count a two-handed item once even though it occupies two slots', () => {
      vi.mocked(getEntry).mockReturnValue(spear);

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: { equipmentId: spear.id },
        Offhand: { equipmentId: spear.id },
      });

      expect(totals.Strength).toBe(spear.baseStats.Strength);
    });
  });

  describe('equippedItems', () => {
    it('returns one entry per distinct equipped item', () => {
      const items = equippedItems({
        ...emptyEquipment,
        Weapon: { equipmentId: sword.id },
        Helmet: { equipmentId: helmet.id },
      });

      expect(items).toHaveLength(2);
      expect(items).toEqual(
        expect.arrayContaining([
          { equipmentId: sword.id },
          { equipmentId: helmet.id },
        ]),
      );
    });

    it('collapses a two-handed item occupying multiple slots into a single entry', () => {
      const items = equippedItems({
        ...emptyEquipment,
        Weapon: { equipmentId: spear.id },
        Offhand: { equipmentId: spear.id },
      });

      expect(items).toEqual([{ equipmentId: spear.id }]);
    });

    it('returns an empty array when nothing is equipped', () => {
      expect(equippedItems(emptyEquipment)).toEqual([]);
    });
  });

  describe('slotsHoldingEquipment', () => {
    it('returns every slot holding the given equipment id', () => {
      const equipment = {
        ...emptyEquipment,
        Weapon: { equipmentId: spear.id },
        Offhand: { equipmentId: spear.id },
      };

      expect(slotsHoldingEquipment(equipment, spear.id)).toEqual([
        'Weapon',
        'Offhand',
      ]);
    });

    it('returns an empty array when the equipment id is not equipped anywhere', () => {
      expect(slotsHoldingEquipment(emptyEquipment, spear.id)).toEqual([]);
    });

    it('does not match slots holding a different equipment id', () => {
      const equipment = {
        ...emptyEquipment,
        Weapon: { equipmentId: sword.id },
      };

      expect(slotsHoldingEquipment(equipment, spear.id)).toEqual([]);
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

  describe('canEquipItem', () => {
    const character = {
      id: 'char-1' as CharacterId,
      level: 5,
      jobId: 'ranger' as JobId,
    } as Character;

    it('allows equipping when level and job requirements are met', () => {
      const item = { ...sword, levelRequirement: 5, requiredJobIds: ['ranger' as JobId] };
      expect(canEquipItem(character, item)).toBe(true);
    });

    it('allows equipping when there is no job requirement at all', () => {
      const item = { ...sword, levelRequirement: 5, requiredJobIds: [] };
      expect(canEquipItem(character, item)).toBe(true);
    });

    it('blocks equipping when the hero is under-level', () => {
      const item = { ...sword, levelRequirement: 6, requiredJobIds: [] };
      expect(canEquipItem(character, item)).toBe(false);
    });

    it('blocks equipping when the hero is the wrong job', () => {
      const item = { ...sword, levelRequirement: 5, requiredJobIds: ['magician' as JobId] };
      expect(canEquipItem(character, item)).toBe(false);
    });

    it('blocks equipping when both level and job requirements fail', () => {
      const item = { ...sword, levelRequirement: 99, requiredJobIds: ['magician' as JobId] };
      expect(canEquipItem(character, item)).toBe(false);
    });
  });

  describe('equipmentAvailableForSlot', () => {
    it('filters to owned items containing the slot, sorted by level requirement descending', () => {
      const lowHelmet = { ...helmet, id: 'low' as EquipmentId, levelRequirement: 1 };
      const highHelmet = { ...helmet, id: 'high' as EquipmentId, levelRequirement: 10 };
      vi.mocked(getEntriesByType).mockReturnValue([
        lowHelmet,
        sword,
        highHelmet,
      ] as never);
      vi.mocked(armoryGet).mockReturnValue([
        { equipmentId: lowHelmet.id },
        { equipmentId: highHelmet.id },
        { equipmentId: sword.id },
      ]);

      expect(equipmentAvailableForSlot('Helmet')).toEqual([
        highHelmet,
        lowHelmet,
      ]);
    });

    it('excludes items not present in the armory', () => {
      const lowHelmet = { ...helmet, id: 'low' as EquipmentId, levelRequirement: 1 };
      const highHelmet = { ...helmet, id: 'high' as EquipmentId, levelRequirement: 10 };
      vi.mocked(getEntriesByType).mockReturnValue([lowHelmet, highHelmet] as never);
      vi.mocked(armoryGet).mockReturnValue([{ equipmentId: lowHelmet.id }]);

      expect(equipmentAvailableForSlot('Helmet')).toEqual([lowHelmet]);
    });
  });

  describe('isSlotAvailableForJob', () => {
    it('is always available for a non-class-exclusive slot', () => {
      expect(isSlotAvailableForJob('Weapon', 'ranger' as JobId)).toBe(true);
      expect(getEntry).not.toHaveBeenCalled();
    });

    it('is available for Artifact only when the job is named Magician', () => {
      vi.mocked(getEntry).mockReturnValue({ name: 'Magician' } as JobContent);
      expect(isSlotAvailableForJob('Artifact', 'magician' as JobId)).toBe(true);

      vi.mocked(getEntry).mockReturnValue({ name: 'Ranger' } as JobContent);
      expect(isSlotAvailableForJob('Artifact', 'ranger' as JobId)).toBe(false);
    });

    it('is available for Ammo only when the job is named Ranger', () => {
      vi.mocked(getEntry).mockReturnValue({ name: 'Ranger' } as JobContent);
      expect(isSlotAvailableForJob('Ammo', 'ranger' as JobId)).toBe(true);

      vi.mocked(getEntry).mockReturnValue({ name: 'Magician' } as JobContent);
      expect(isSlotAvailableForJob('Ammo', 'magician' as JobId)).toBe(false);
    });
  });
});
