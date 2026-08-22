import type * as MaterialsHelper from '@helpers/materials';
import type {
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  ItemContent,
  ItemId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/materials', async (importOriginal) => {
  const actual = await importOriginal<typeof MaterialsHelper>();
  return {
    ...actual,
    getMaterialQuantity: vi.fn(),
    getGoldQuantity: vi.fn(),
  };
});

import { getEntry } from '@helpers/content';
import {
  canInfuseEquipmentItem,
  equipmentItemInfusionBonus,
  equipmentItemInfusionResistanceBonus,
  equipmentItemSlotCount,
  infusionMaterialCost,
  isInfusionMaterial,
} from '@helpers/infusion';
import { getGoldQuantity, getMaterialQuantity } from '@helpers/materials';

const crystal: ItemContent = {
  id: 'crystal' as ItemId,
  name: 'Minor Crystal',
  __type: 'item',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  infusionStats: {
    Agility: 0,
    Energy: 0,
    Health: 0,
    Intelligence: 0,
    Luck: 0,
    Resistance: 0,
    Strength: 1,
    Vitality: 0,
  },
};

const goldCoin: ItemContent = {
  id: 'gold-coin' as ItemId,
  name: 'Gold Coin',
  __type: 'item',
  description: '',
  sprite: '0001',
  rarity: 'Common',
};

const plainMaterial: ItemContent = {
  id: 'plain' as ItemId,
  name: 'Plain Material',
  __type: 'item',
  description: '',
  sprite: '0002',
  rarity: 'Common',
};

// Resistance-only material - no infusionStats at all, only infusionDebuffResistances.
const spiritFlesh: ItemContent = {
  id: 'spirit-flesh' as ItemId,
  name: 'Spirit Flesh',
  __type: 'item',
  description: '',
  sprite: '0031',
  rarity: 'Common',
  infusionDebuffResistances: {
    Stun: 0,
    StatDown: 2,
    Accuracy: 0,
    DamageOverTime: 0,
    Poison: 0,
    Burn: 0,
  },
};

const sword: EquipmentContent = {
  id: 'sword' as EquipmentId,
  name: 'Sword',
  __type: 'equipment',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  levelRequirement: 1,
  baseStats: {
    Agility: 0,
    Energy: 0,
    Health: 0,
    Intelligence: 0,
    Luck: 0,
    Resistance: 0,
    Strength: 5,
    Vitality: 0,
  },
  type: 'Sword',
  slots: 2,
};

const swordItem: EquipmentItem = {
  id: 'sword-1' as EquipmentItemId,
  equipmentId: sword.id,
  infusedItemIds: [],
};

function mockContentEntry(id: string) {
  if (id === crystal.id) return crystal;
  if (id === goldCoin.id || id === goldCoin.name) return goldCoin;
  if (id === plainMaterial.id) return plainMaterial;
  if (id === spiritFlesh.id) return spiritFlesh;
  if (id === sword.id) return sword;
  return undefined;
}

describe('Infusion Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntry).mockImplementation((id) => mockContentEntry(id) as never);
  });

  describe('equipmentItemInfusionBonus', () => {
    it('sums infusionStats of every non-null slot', () => {
      const bonus = equipmentItemInfusionBonus([crystal.id, crystal.id]);
      expect(bonus.Strength).toBe(2);
    });

    it('skips null (empty) slots', () => {
      const bonus = equipmentItemInfusionBonus([crystal.id, null]);
      expect(bonus.Strength).toBe(1);
    });

    it('skips ids that resolve to no content or no infusionStats', () => {
      const bonus = equipmentItemInfusionBonus(['missing' as ItemId, plainMaterial.id]);
      expect(bonus.Strength).toBe(0);
    });

    it('returns zeroed stats for an empty array', () => {
      const bonus = equipmentItemInfusionBonus([]);
      expect(bonus.Strength).toBe(0);
    });
  });

  describe('equipmentItemInfusionResistanceBonus', () => {
    it('sums infusionDebuffResistances of every non-null slot', () => {
      const bonus = equipmentItemInfusionResistanceBonus([
        spiritFlesh.id,
        spiritFlesh.id,
      ]);
      expect(bonus.StatDown).toBe(4);
    });

    it('skips null (empty) slots', () => {
      const bonus = equipmentItemInfusionResistanceBonus([spiritFlesh.id, null]);
      expect(bonus.StatDown).toBe(2);
    });

    it('skips ids that resolve to no content or no infusionDebuffResistances', () => {
      const bonus = equipmentItemInfusionResistanceBonus([
        'missing' as ItemId,
        crystal.id,
      ]);
      expect(bonus.StatDown).toBe(0);
    });

    it('returns zeroed resistances for an empty array', () => {
      const bonus = equipmentItemInfusionResistanceBonus([]);
      expect(bonus.StatDown).toBe(0);
    });
  });

  describe('equipmentItemSlotCount', () => {
    it("returns the equipment content's slots", () => {
      expect(equipmentItemSlotCount(sword.id)).toBe(2);
    });

    it('returns 0 when the content cannot be found', () => {
      expect(equipmentItemSlotCount('missing' as EquipmentId)).toBe(0);
    });
  });

  describe('isInfusionMaterial', () => {
    it('is true when infusionStats has a nonzero value', () => {
      expect(isInfusionMaterial(crystal)).toBe(true);
    });

    it('is false when infusionStats is absent', () => {
      expect(isInfusionMaterial(plainMaterial)).toBe(false);
    });

    it('is false when infusionStats is present but all zero', () => {
      expect(
        isInfusionMaterial({
          ...plainMaterial,
          infusionStats: {
            Agility: 0,
            Energy: 0,
            Health: 0,
            Intelligence: 0,
            Luck: 0,
            Resistance: 0,
            Strength: 0,
            Vitality: 0,
          },
        }),
      ).toBe(false);
    });

    it('is true when only infusionDebuffResistances has a nonzero value (no infusionStats at all)', () => {
      expect(isInfusionMaterial(spiritFlesh)).toBe(true);
    });

    it('is false when infusionDebuffResistances is present but all zero', () => {
      expect(
        isInfusionMaterial({
          ...plainMaterial,
          infusionDebuffResistances: {
            Stun: 0,
            StatDown: 0,
            Accuracy: 0,
            DamageOverTime: 0,
            Poison: 0,
            Burn: 0,
          },
        }),
      ).toBe(false);
    });
  });

  describe('infusionMaterialCost', () => {
    it('costs 30g per total stat point', () => {
      expect(infusionMaterialCost(crystal.id)).toBe(30);
    });

    it('scales up to 300g for +10 total', () => {
      vi.mocked(getEntry).mockReturnValue({
        ...crystal,
        infusionStats: { ...crystal.infusionStats, Strength: 10 },
      } as never);

      expect(infusionMaterialCost(crystal.id)).toBe(300);
    });

    it('costs 0 when the item has no infusionStats', () => {
      expect(infusionMaterialCost(plainMaterial.id)).toBe(0);
    });

    it('costs 100g per total resistance point for a resistance-only item', () => {
      expect(infusionMaterialCost(spiritFlesh.id)).toBe(200);
    });

    it('sums both infusionStats (30g/point) and infusionDebuffResistances (100g/point) when an item has both', () => {
      vi.mocked(getEntry).mockReturnValue({
        ...crystal,
        infusionDebuffResistances: spiritFlesh.infusionDebuffResistances,
      } as never);

      expect(infusionMaterialCost(crystal.id)).toBe(30 + 200);
    });
  });

  describe('canInfuseEquipmentItem', () => {
    beforeEach(() => {
      vi.mocked(getMaterialQuantity).mockReturnValue(1000);
      vi.mocked(getGoldQuantity).mockReturnValue(1000);
    });

    it('allows infusing an empty slot when material and gold are available', () => {
      expect(canInfuseEquipmentItem(swordItem, 0, crystal.id)).toBe(true);
    });

    it('allows overwriting an already-infused slot', () => {
      const infused: EquipmentItem = {
        ...swordItem,
        infusedItemIds: [crystal.id, null],
      };
      expect(canInfuseEquipmentItem(infused, 0, crystal.id)).toBe(true);
    });

    it('rejects a negative slot index', () => {
      expect(canInfuseEquipmentItem(swordItem, -1, crystal.id)).toBe(false);
    });

    it('rejects a slot index at or beyond the item slot count', () => {
      expect(canInfuseEquipmentItem(swordItem, 2, crystal.id)).toBe(false);
    });

    it('rejects a material with no infusionStats', () => {
      expect(canInfuseEquipmentItem(swordItem, 0, plainMaterial.id)).toBe(false);
    });

    it('allows a resistance-only material (no infusionStats)', () => {
      expect(canInfuseEquipmentItem(swordItem, 0, spiritFlesh.id)).toBe(true);
    });

    it('rejects when the player does not own the material', () => {
      vi.mocked(getMaterialQuantity).mockImplementation((id) =>
        id === crystal.id ? 0 : 1000,
      );
      expect(canInfuseEquipmentItem(swordItem, 0, crystal.id)).toBe(false);
    });

    it('rejects when the player cannot afford the gold cost', () => {
      vi.mocked(getGoldQuantity).mockReturnValue(0);
      expect(canInfuseEquipmentItem(swordItem, 0, crystal.id)).toBe(false);
    });
  });
});
