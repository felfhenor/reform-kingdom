import { seedContent } from '@/testing/content';
import { buildEquipmentItem } from '@/testing/builders';
import { defaultEquipment } from '@helpers/defaults';
import { ensureEquipment } from '@helpers/content/ensure-item';
import { equipmentSkillStatBonuses } from '@helpers/item/equipment-skill-bonus';
import type {
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

function buildContent(
  id: string,
  skillStatBonuses: EquipmentContent['skillStatBonuses'],
): EquipmentContent {
  return ensureEquipment({
    id: id as EquipmentId,
    type: 'Staff',
    skillStatBonuses,
  });
}

const buildItem = (equipmentId: string) =>
  buildEquipmentItem(equipmentId as EquipmentId);

const emptyEquipment = defaultEquipment();

describe('equipmentSkillStatBonuses', () => {
  const staff = buildContent('staff', [
    { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
  ]);
  const ring = buildContent('ring', [
    { skillFamily: 'Snipe', stat: 'Agility', value: 0.5 },
  ]);

  beforeEach(() => {
    seedContent([staff, ring]);
  });

  it('collects the bonuses of every equipped item', () => {
    const equipment: EquipmentBlock = {
      ...emptyEquipment,
      Weapon: buildItem('staff'),
      Ring: buildItem('ring'),
    };

    expect(equipmentSkillStatBonuses(equipment)).toEqual([
      { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
      { skillFamily: 'Snipe', stat: 'Agility', value: 0.5 },
    ]);
  });

  it('counts a two-handed item once even though it fills two slots', () => {
    const twoHander = buildItem('staff');
    const equipment: EquipmentBlock = {
      ...emptyEquipment,
      Weapon: twoHander,
      Offhand: twoHander,
    };

    expect(equipmentSkillStatBonuses(equipment)).toEqual([
      { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
    ]);
  });

  it('returns nothing for an empty equipment block', () => {
    expect(equipmentSkillStatBonuses(emptyEquipment)).toEqual([]);
  });
});
