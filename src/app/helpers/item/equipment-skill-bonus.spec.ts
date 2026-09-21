vi.mock('@helpers/content/content', () => ({ getEntry: vi.fn() }));

import { getEntry } from '@helpers/content/content';
import { equipmentSkillStatBonuses } from '@helpers/item/equipment-skill-bonus';
import type {
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function buildContent(
  id: string,
  skillStatBonuses: EquipmentContent['skillStatBonuses'],
): EquipmentContent {
  return {
    id: id as EquipmentId,
    name: id,
    __type: 'equipment',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    levelRequirement: 1,
    baseStats: {} as never,
    type: 'Staff',
    slots: 0,
    grantedSkillIds: [],
    skillStatBonuses,
  };
}

function buildItem(id: string, equipmentId: string): EquipmentItem {
  return {
    id: id as EquipmentItemId,
    equipmentId: equipmentId as EquipmentId,
    infusedItemIds: [],
    affixIds: [],
  };
}

describe('equipmentSkillStatBonuses', () => {
  const staff = buildContent('staff', [
    { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
  ]);
  const ring = buildContent('ring', [
    { skillFamily: 'Snipe', stat: 'Agility', value: 0.5 },
  ]);

  beforeEach(() => {
    vi.mocked(getEntry).mockImplementation(
      (id) => [staff, ring].find((entry) => entry.id === id) as never,
    );
  });

  it('collects the bonuses of every equipped item', () => {
    const equipment = {
      Weapon: buildItem('a', 'staff'),
      Ring: buildItem('b', 'ring'),
    } as EquipmentBlock;

    expect(equipmentSkillStatBonuses(equipment)).toEqual([
      { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
      { skillFamily: 'Snipe', stat: 'Agility', value: 0.5 },
    ]);
  });

  it('counts a two-handed item once even though it fills two slots', () => {
    const twoHander = buildItem('a', 'staff');
    const equipment = {
      Weapon: twoHander,
      Offhand: twoHander,
    } as EquipmentBlock;

    expect(equipmentSkillStatBonuses(equipment)).toEqual([
      { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
    ]);
  });

  it('returns nothing for an empty equipment block', () => {
    expect(equipmentSkillStatBonuses({} as EquipmentBlock)).toEqual([]);
  });
});
