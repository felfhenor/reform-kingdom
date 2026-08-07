import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  JobContent,
  JobId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat', () => ({
  currentCombat: vi.fn(),
}));

import { armoryGet } from '@helpers/armory';
import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import {
  canEquipItem,
  canModifyEquipment,
  equipmentAvailableForSlot,
  equipmentStatTotals,
  equippedItems,
  equippedItemsByPrimarySlot,
  equippedItemTypes,
  isSlotAvailableForJob,
  pruneInvalidEquippedItems,
  slotsHoldingEquipment,
} from '@helpers/equipment';
import type { Combat } from '@interfaces';

// A distinct EquipmentItem instance for a given content id - equipped-item
// dedup is now keyed by instance id, not content id, so every fixture that
// represents a distinct physical item needs its own id (and a two-handed
// item occupying two slots must reuse the *same* instance across both).
function mockEquipmentItem(
  equipmentId: EquipmentId,
  id = equipmentId,
): EquipmentItem {
  return {
    id: id as unknown as EquipmentItemId,
    equipmentId,
    infusedItemIds: [],
  };
}

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
    type: 'Sword',
    slots: 1,
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
    type: 'Hat',
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
    type: 'Spear',
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

    it('should sum baseStats across all equipped slots', () => {
      vi.mocked(getEntry).mockImplementation((id) =>
        (id === 'sword' ? sword : helmet) as never,
      );

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
        Helmet: mockEquipmentItem(helmet.id),
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
        Weapon: mockEquipmentItem('missing' as EquipmentId),
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
      const spearItem = mockEquipmentItem(spear.id);

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: spearItem,
        Offhand: spearItem,
      });

      expect(totals.Strength).toBe(spear.baseStats.Strength);
    });

    it('adds each equipped item\'s infusion bonus on top of its baseStats', () => {
      const infusionCrystal = {
        id: 'crystal' as never,
        name: 'Crystal',
        __type: 'item',
        description: '',
        sprite: '0000',
        rarity: 'Common',
        infusionStats: {
          Health: 0,
          Energy: 0,
          Luck: 0,
          Intelligence: 0,
          Strength: 2,
          Vitality: 0,
          Resistance: 0,
          Agility: 0,
        },
      };
      vi.mocked(getEntry).mockImplementation((id) =>
        (id === 'sword' ? sword : id === 'crystal' ? infusionCrystal : undefined) as never,
      );

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: {
          ...mockEquipmentItem(sword.id),
          infusedItemIds: ['crystal' as never],
        },
      });

      expect(totals.Strength).toBe(sword.baseStats.Strength + 2);
    });
  });

  describe('equippedItems', () => {
    it('returns one entry per distinct equipped item', () => {
      const swordItem = mockEquipmentItem(sword.id);
      const helmetItem = mockEquipmentItem(helmet.id);

      const items = equippedItems({
        ...emptyEquipment,
        Weapon: swordItem,
        Helmet: helmetItem,
      });

      expect(items).toHaveLength(2);
      expect(items).toEqual(expect.arrayContaining([swordItem, helmetItem]));
    });

    it('collapses a two-handed item occupying multiple slots into a single entry', () => {
      const spearItem = mockEquipmentItem(spear.id);

      const items = equippedItems({
        ...emptyEquipment,
        Weapon: spearItem,
        Offhand: spearItem,
      });

      expect(items).toEqual([spearItem]);
    });

    it('returns an empty array when nothing is equipped', () => {
      expect(equippedItems(emptyEquipment)).toEqual([]);
    });
  });

  describe('equippedItemsByPrimarySlot', () => {
    it('returns one entry per distinct equipped item, keyed by slot', () => {
      vi.mocked(getEntry).mockImplementation((id) =>
        (id === sword.id ? sword : helmet) as never,
      );
      const swordItem = mockEquipmentItem(sword.id);
      const helmetItem = mockEquipmentItem(helmet.id);

      const items = equippedItemsByPrimarySlot({
        ...emptyEquipment,
        Weapon: swordItem,
        Helmet: helmetItem,
      });

      expect(items).toHaveLength(2);
      expect(items).toEqual(expect.arrayContaining([swordItem, helmetItem]));
    });

    it('only returns a two-handed item once, from its primary slot', () => {
      vi.mocked(getEntry).mockReturnValue(spear);
      const spearItem = mockEquipmentItem(spear.id);

      const items = equippedItemsByPrimarySlot({
        ...emptyEquipment,
        Weapon: spearItem,
        Offhand: spearItem,
      });

      expect(items).toEqual([spearItem]);
    });

    // The real-world case this guards against: a legacy save whose
    // two-handed item was backfilled with a different instance id per slot
    // (see `backfillEquipmentBlock`) - even though the two slots don't
    // share an id, primary-slot dedup still only surfaces it once.
    it('only returns a two-handed item once even if its slots hold different instance ids', () => {
      vi.mocked(getEntry).mockReturnValue(spear);

      const items = equippedItemsByPrimarySlot({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(spear.id, 'weapon-instance' as EquipmentId),
        Offhand: mockEquipmentItem(spear.id, 'offhand-instance' as EquipmentId),
      });

      expect(items).toHaveLength(1);
      expect(items[0].equipmentId).toBe(spear.id);
    });

    it('ignores slots whose equipment content cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      expect(
        equippedItemsByPrimarySlot({
          ...emptyEquipment,
          Weapon: mockEquipmentItem('missing' as EquipmentId),
        }),
      ).toEqual([]);
    });

    it('returns an empty array when nothing is equipped', () => {
      expect(equippedItemsByPrimarySlot(emptyEquipment)).toEqual([]);
    });
  });

  describe('equippedItemTypes', () => {
    it('returns the content type of each distinct equipped item', () => {
      vi.mocked(getEntry).mockImplementation((id) =>
        (id === sword.id ? sword : spear) as never,
      );

      const types = equippedItemTypes({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id, 'weapon-instance' as EquipmentId),
        Offhand: mockEquipmentItem(spear.id, 'offhand-instance' as EquipmentId),
      });

      expect(types).toEqual(expect.arrayContaining(['Sword', 'Spear']));
      expect(types).toHaveLength(2);
    });

    it('ignores slots whose equipment content cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      expect(
        equippedItemTypes({
          ...emptyEquipment,
          Weapon: mockEquipmentItem('missing' as EquipmentId),
        }),
      ).toEqual([]);
    });

    it('returns an empty array when nothing is equipped', () => {
      expect(equippedItemTypes(emptyEquipment)).toEqual([]);
      expect(getEntry).not.toHaveBeenCalled();
    });
  });

  describe('pruneInvalidEquippedItems', () => {
    it('leaves slots whose equipment resolves to real content untouched', () => {
      vi.mocked(getEntry).mockReturnValue(sword);
      const equipment = {
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
      };

      expect(pruneInvalidEquippedItems(equipment)).toEqual(equipment);
    });

    it('clears slots whose equipmentId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const equipment = {
        ...emptyEquipment,
        Weapon: mockEquipmentItem('stale-gear' as EquipmentId),
      };

      expect(pruneInvalidEquippedItems(equipment)).toEqual(emptyEquipment);
    });

    it('prunes only the invalid slots out of a mix of valid and invalid gear', () => {
      vi.mocked(getEntry).mockImplementation((id) =>
        (id === sword.id ? sword : undefined) as never,
      );
      const swordItem = mockEquipmentItem(sword.id);
      const equipment = {
        ...emptyEquipment,
        Weapon: swordItem,
        Helmet: mockEquipmentItem('stale-gear' as EquipmentId),
      };

      expect(pruneInvalidEquippedItems(equipment)).toEqual({
        ...emptyEquipment,
        Weapon: swordItem,
      });
    });

    it('returns an equivalent block when nothing is equipped', () => {
      expect(pruneInvalidEquippedItems(emptyEquipment)).toEqual(
        emptyEquipment,
      );
      expect(getEntry).not.toHaveBeenCalled();
    });
  });

  describe('slotsHoldingEquipment', () => {
    it('returns every slot holding the given equipment id', () => {
      const spearItem = mockEquipmentItem(spear.id);
      const equipment = {
        ...emptyEquipment,
        Weapon: spearItem,
        Offhand: spearItem,
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
        Weapon: mockEquipmentItem(sword.id),
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
      vi.mocked(getEntry).mockReturnValue({
        equippableTypes: ['Sword'],
      } as JobContent);
      const item = { ...sword, levelRequirement: 5 };
      expect(canEquipItem(character, item)).toBe(true);
    });

    it('blocks equipping when the job cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const item = { ...sword, levelRequirement: 5 };
      expect(canEquipItem(character, item)).toBe(false);
    });

    it('blocks equipping when the hero is under-level', () => {
      vi.mocked(getEntry).mockReturnValue({
        equippableTypes: ['Sword'],
      } as JobContent);
      const item = { ...sword, levelRequirement: 6 };
      expect(canEquipItem(character, item)).toBe(false);
    });

    it('blocks equipping when the hero is the wrong job', () => {
      vi.mocked(getEntry).mockReturnValue({
        equippableTypes: ['Hat'],
      } as JobContent);
      const item = { ...sword, levelRequirement: 5 };
      expect(canEquipItem(character, item)).toBe(false);
    });

    it('blocks equipping when both level and job requirements fail', () => {
      vi.mocked(getEntry).mockReturnValue({
        equippableTypes: ['Hat'],
      } as JobContent);
      const item = { ...sword, levelRequirement: 99 };
      expect(canEquipItem(character, item)).toBe(false);
    });
  });

  describe('equipmentAvailableForSlot', () => {
    it('filters to owned items containing the slot, sorted by level requirement descending', () => {
      const lowHelmet = { ...helmet, id: 'low' as EquipmentId, levelRequirement: 1 };
      const highHelmet = { ...helmet, id: 'high' as EquipmentId, levelRequirement: 10 };
      const lowHelmetItem = mockEquipmentItem(lowHelmet.id);
      const highHelmetItem = mockEquipmentItem(highHelmet.id);
      const swordItem = mockEquipmentItem(sword.id);

      vi.mocked(getEntry).mockImplementation((id) => {
        if (id === lowHelmet.id) return lowHelmet as never;
        if (id === highHelmet.id) return highHelmet as never;
        if (id === sword.id) return sword as never;
        return undefined as never;
      });
      vi.mocked(armoryGet).mockReturnValue([
        lowHelmetItem,
        highHelmetItem,
        swordItem,
      ]);

      expect(equipmentAvailableForSlot('Helmet')).toEqual([
        { item: highHelmetItem, content: highHelmet },
        { item: lowHelmetItem, content: lowHelmet },
      ]);
    });

    it('excludes items not present in the armory', () => {
      const lowHelmet = { ...helmet, id: 'low' as EquipmentId, levelRequirement: 1 };
      const highHelmet = { ...helmet, id: 'high' as EquipmentId, levelRequirement: 10 };
      const lowHelmetItem = mockEquipmentItem(lowHelmet.id);

      vi.mocked(getEntry).mockImplementation((id) => {
        if (id === lowHelmet.id) return lowHelmet as never;
        if (id === highHelmet.id) return highHelmet as never;
        return undefined as never;
      });
      vi.mocked(armoryGet).mockReturnValue([lowHelmetItem]);

      expect(equipmentAvailableForSlot('Helmet')).toEqual([
        { item: lowHelmetItem, content: lowHelmet },
      ]);
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
