import type { EquipmentItemType, EquipmentSlot } from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';
import { afterEach, describe, expect, it } from 'vitest';

import {
  equipmentSlotGroups,
  equipmentSlotLayouts,
  equipmentSlotsKey,
} from '@helpers/item/equipment-slot-groups';

const slotTable = EquipmentTypeToSlot as Record<string, EquipmentSlot[]>;
const extraTypes: EquipmentItemType[] = [];

function addType(name: string, slots: EquipmentSlot[]): void {
  slotTable[name] = slots;
  extraTypes.push(name as EquipmentItemType);
}

afterEach(() => {
  extraTypes.splice(0).forEach((type) => delete slotTable[type]);
});

describe('equipmentSlotsKey', () => {
  it('ignores slot order', () => {
    expect(equipmentSlotsKey(['Offhand', 'Weapon'])).toBe(
      equipmentSlotsKey(['Weapon', 'Offhand']),
    );
  });
});

describe('equipmentSlotGroups', () => {
  it('groups only Weapon and Offhand with the current item types', () => {
    expect(equipmentSlotGroups()).toEqual([
      ['Armor'],
      ['Helmet'],
      ['Weapon', 'Offhand'],
      ['Ring'],
      ['Accessory'],
      ['Artifact'],
      ['Ammo'],
    ]);
  });

  it('groups any slots a new multi-slot type bridges', () => {
    addType('Robe', ['Armor', 'Helmet']);

    expect(equipmentSlotGroups()).toContainEqual(['Armor', 'Helmet']);
    expect(equipmentSlotGroups()).not.toContainEqual(['Armor']);
  });

  it('merges groups chained through overlapping types', () => {
    addType('Robe', ['Armor', 'Helmet']);
    addType('Mantle', ['Helmet', 'Accessory']);

    expect(equipmentSlotGroups()).toContainEqual([
      'Armor',
      'Helmet',
      'Accessory',
    ]);
  });
});

describe('equipmentSlotLayouts', () => {
  it('lists every non-overlapping cover of the slots, including leaving them as-is', () => {
    const layouts = equipmentSlotLayouts(
      ['Weapon', 'Offhand'],
      [['Weapon', 'Offhand'], ['Weapon'], ['Offhand']],
    );

    expect(layouts).toEqual([
      [],
      [['Offhand']],
      [['Weapon', 'Offhand']],
      [['Weapon']],
      [['Weapon'], ['Offhand']],
    ]);
  });

  it('skips patterns that reach outside the given slots', () => {
    expect(
      equipmentSlotLayouts(['Armor'], [['Armor', 'Helmet'], ['Armor']]),
    ).toEqual([[], [['Armor']]]);
  });
});
