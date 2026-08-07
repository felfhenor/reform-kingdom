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

vi.mock('@helpers/materials', () => ({
  getMaterialQuantity: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import {
  canInfuseEquipmentItem,
  equipmentItemInfusionBonus,
  equipmentItemSlotCount,
  infusionMaterialCost,
  isInfusionMaterial,
} from '@helpers/infusion';
import { getMaterialQuantity } from '@helpers/materials';

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
  });

  describe('canInfuseEquipmentItem', () => {
    beforeEach(() => {
      vi.mocked(getMaterialQuantity).mockReturnValue(1000);
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

    it('rejects when the player does not own the material', () => {
      vi.mocked(getMaterialQuantity).mockImplementation((id) =>
        id === crystal.id ? 0 : 1000,
      );
      expect(canInfuseEquipmentItem(swordItem, 0, crystal.id)).toBe(false);
    });

    it('rejects when the player cannot afford the gold cost', () => {
      vi.mocked(getMaterialQuantity).mockImplementation((id) =>
        id === goldCoin.id ? 0 : 1000,
      );
      expect(canInfuseEquipmentItem(swordItem, 0, crystal.id)).toBe(false);
    });
  });
});
