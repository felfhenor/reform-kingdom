import type {
  AffixId,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  ItemId,
  TradeskillId,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  GOLD_PER_SKILL_STAT_BONUS_POINT,
  VALUE_MULTIPLIER_PER_STAT,
  GOLD_PER_ELEMENT_RESIST_POINT,
  VALUE_MULTIPLIER_PER_ELEMENT,
} from '@helpers/config';
import {
  canInfuseEquipmentItem,
  equipmentItemInfusionBonus,
  equipmentItemInfusionCombatStatBonus,
  equipmentItemInfusionResistanceBonus,
  equipmentItemSlotCount,
  infusionMaterialCost,
  isInfusionMaterial,
} from '@helpers/item/infusion';
import { applyMaterialDelta } from '@helpers/item/materials';
import { ensureAffix } from '@helpers/content/ensure-affix';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import {
  defaultAffinities,
  defaultStats,
  defaultCombatStats,
  defaultTagResistances,
  defaultMonsterTypeDamageBonus,
} from '@helpers/defaults';

const crystal = ensureItem({
  id: 'crystal' as ItemId,
  name: 'Minor Crystal',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  infusionStats: { ...defaultStats(), Strength: 1 },
});

const goldCoin = ensureItem({
  id: 'gold-coin' as ItemId,
  name: 'Gold Coin',
  description: '',
  sprite: '0001',
  rarity: 'Common',
});

const plainMaterial = ensureItem({
  id: 'plain' as ItemId,
  name: 'Plain Material',
  description: '',
  sprite: '0002',
  rarity: 'Common',
});

// Resistance-only material - no infusionStats at all, only infusionDebuffResistances.
const spiritFlesh = ensureItem({
  id: 'spirit-flesh' as ItemId,
  name: 'Spirit Flesh',
  description: '',
  sprite: '0031',
  rarity: 'Common',
  infusionDebuffResistances: { ...defaultTagResistances(), StatDown: 2 },
});

// Combat-stat-only material - no infusionStats at all, only infusionCombatStats.
const vengeanceShard = ensureItem({
  id: 'vengeance-shard' as ItemId,
  name: 'Vengeance Shard',
  description: '',
  sprite: '0032',
  rarity: 'Common',
  infusionCombatStats: { ...defaultCombatStats(), damageReflectPercent: 3 },
});

// MonsterTypeDamage-only material - no infusionStats at all, only infusionMonsterTypeDamage.
const fangShard = ensureItem({
  id: 'fang-shard' as ItemId,
  name: 'Fang Shard',
  description: '',
  sprite: '0033',
  rarity: 'Common',
  infusionMonsterTypeDamage: { ...defaultMonsterTypeDamageBonus(), Beast: 10 },
});

// GatherYield-only material - no infusionStats at all, only infusionGatherYieldBonuses.
const woodShard = ensureItem({
  id: 'wood-shard' as ItemId,
  name: 'Wood Shard',
  description: '',
  sprite: '0034',
  rarity: 'Common',
  infusionGatherYieldBonuses: [
    { tradeskillId: 'Woodworking' as TradeskillId, value: 1 },
  ],
});

const sword = ensureEquipment({
  id: 'sword' as EquipmentId,
  name: 'Sword',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  levelRequirement: 1,
  baseStats: { ...defaultStats(), Strength: 5 },
  type: 'Sword',
  slots: 2,
  grantedSkillIds: [],
});

const swordItem = buildEquipmentItem(sword.id, {
  id: 'sword-1' as EquipmentItemId,
});

const allContent = [
  crystal,
  goldCoin,
  plainMaterial,
  spiritFlesh,
  vengeanceShard,
  fangShard,
  woodShard,
  sword,
];

// Every non-gold item at `materialQty`, plus `goldQty` gold.
function stock(materialQty: number, goldQty: number): void {
  seedGamestate((state) => {
    allContent
      .filter((entry) => entry.__type === 'item' && entry !== goldCoin)
      .forEach((entry) =>
        applyMaterialDelta(state, entry.id as ItemId, materialQty),
      );
    applyMaterialDelta(state, goldCoin.id, goldQty);
  });
}

describe('Infusion Helper Functions', () => {
  beforeEach(() => {
    seedContent(allContent);
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
      const bonus = equipmentItemInfusionBonus([
        'missing' as ItemId,
        plainMaterial.id,
      ]);
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
      const bonus = equipmentItemInfusionResistanceBonus([
        spiritFlesh.id,
        null,
      ]);
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

  describe('equipmentItemInfusionCombatStatBonus', () => {
    it('sums infusionCombatStats of every non-null slot', () => {
      const bonus = equipmentItemInfusionCombatStatBonus([
        vengeanceShard.id,
        vengeanceShard.id,
      ]);
      expect(bonus.damageReflectPercent).toBe(6);
    });

    it('skips null (empty) slots', () => {
      const bonus = equipmentItemInfusionCombatStatBonus([
        vengeanceShard.id,
        null,
      ]);
      expect(bonus.damageReflectPercent).toBe(3);
    });

    it('skips ids that resolve to no content or no infusionCombatStats', () => {
      const bonus = equipmentItemInfusionCombatStatBonus([
        'missing' as ItemId,
        crystal.id,
      ]);
      expect(bonus.damageReflectPercent).toBe(0);
    });

    it('returns zeroed combat stats for an empty array', () => {
      const bonus = equipmentItemInfusionCombatStatBonus([]);
      expect(bonus.damageReflectPercent).toBe(0);
    });
  });

  describe('equipmentItemSlotCount', () => {
    it("returns the equipment content's slots", () => {
      expect(equipmentItemSlotCount(swordItem)).toBe(2);
    });

    it('returns 0 when the content cannot be found', () => {
      const missing: EquipmentItem = {
        ...swordItem,
        equipmentId: 'missing' as EquipmentId,
      };
      expect(equipmentItemSlotCount(missing)).toBe(0);
    });

    it('adds an InfusionSlot affix bonus on top of the base slot count', () => {
      const slotAffix = ensureAffix({
        id: 'affix-slot' as AffixId,
        rarity: 'Rare',
        family: 'InfusionSlot',
        effects: [{ kind: 'InfusionSlot', value: 1 }],
      });
      seedContent([...allContent, slotAffix]);

      const withAffix: EquipmentItem = {
        ...swordItem,
        affixIds: [slotAffix.id],
      };
      expect(equipmentItemSlotCount(withAffix)).toBe(3);
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
          infusionStats: { ...defaultStats() },
        }),
      ).toBe(false);
    });

    it('is true when only infusionDebuffResistances has a nonzero value (no infusionStats at all)', () => {
      expect(isInfusionMaterial(spiritFlesh)).toBe(true);
    });

    it('is true when only infusionCombatStats has a nonzero value (no infusionStats at all)', () => {
      expect(isInfusionMaterial(vengeanceShard)).toBe(true);
    });

    it('is false when infusionDebuffResistances is present but all zero', () => {
      expect(
        isInfusionMaterial({
          ...plainMaterial,
          infusionDebuffResistances: { ...defaultTagResistances() },
        }),
      ).toBe(false);
    });

    it('is true when only infusionMonsterTypeDamage has a nonzero value (no infusionStats at all)', () => {
      expect(isInfusionMaterial(fangShard)).toBe(true);
    });

    it('is false when infusionMonsterTypeDamage is present but all zero', () => {
      expect(
        isInfusionMaterial({
          ...plainMaterial,
          infusionMonsterTypeDamage: { ...defaultMonsterTypeDamageBonus() },
        }),
      ).toBe(false);
    });

    it('is true when only infusionGatherYieldBonuses has a nonzero value (no infusionStats at all)', () => {
      expect(isInfusionMaterial(woodShard)).toBe(true);
    });

    it('is true when only an elemental block has a nonzero value', () => {
      expect(
        isInfusionMaterial({
          ...plainMaterial,
          infusionElementalResistances: { ...defaultAffinities(), Fire: 5 },
        }),
      ).toBe(true);
      expect(
        isInfusionMaterial({
          ...plainMaterial,
          infusionElementalBoons: { ...defaultAffinities(), Air: 5 },
        }),
      ).toBe(true);
    });

    it('is true when only infusionSkillStatBonuses has a nonzero value', () => {
      expect(
        isInfusionMaterial({
          ...plainMaterial,
          infusionSkillStatBonuses: [
            { skillFamily: 'Fireball', stat: 'Vitality', value: 0.5 },
          ],
        }),
      ).toBe(true);
    });

    it('is false when infusionSkillStatBonuses is present but all zero', () => {
      expect(
        isInfusionMaterial({
          ...plainMaterial,
          infusionSkillStatBonuses: [
            { skillFamily: 'Fireball', stat: 'Vitality', value: 0 },
          ],
        }),
      ).toBe(false);
    });

    it('is false when infusionGatherYieldBonuses is present but all zero', () => {
      expect(
        isInfusionMaterial({
          ...plainMaterial,
          infusionGatherYieldBonuses: [
            { tradeskillId: 'Woodworking' as TradeskillId, value: 0 },
          ],
        }),
      ).toBe(false);
    });
  });

  describe('infusionMaterialCost', () => {
    // crystal grants +1 Strength; Strength's VALUE_MULTIPLIER_PER_STAT is 5, so 30g * 1 * 5 = 150g.
    it('costs 30g per stat point, scaled by VALUE_MULTIPLIER_PER_STAT for the stat', () => {
      expect(infusionMaterialCost(crystal.id)).toBe(150);
    });

    it('scales up to 1500g for +10 total', () => {
      seedContent([
        ensureItem({
          ...crystal,
          infusionStats: { ...crystal.infusionStats, Strength: 10 },
        }),
      ]);

      expect(infusionMaterialCost(crystal.id)).toBe(1500);
    });

    // Strength (x5) + Luck (x10): 30g * (1*5 + 2*10) = 30g * 25 = 750g.
    it('weights each stat independently when a material grants more than one', () => {
      seedContent([
        ensureItem({
          ...crystal,
          infusionStats: { ...crystal.infusionStats, Strength: 1, Luck: 2 },
        }),
      ]);

      expect(infusionMaterialCost(crystal.id)).toBe(750);
    });

    it('costs GOLD_PER_SKILL_STAT_BONUS_POINT per 1.0x of scaling, weighted by the boosted stat', () => {
      seedContent([
        ensureItem({
          ...plainMaterial,
          infusionSkillStatBonuses: [
            { skillFamily: 'Fireball', stat: 'Vitality', value: 0.5 },
          ],
        }),
      ]);

      expect(infusionMaterialCost(plainMaterial.id)).toBe(
        GOLD_PER_SKILL_STAT_BONUS_POINT *
          0.5 *
          VALUE_MULTIPLIER_PER_STAT.Vitality,
      );
    });

    it('costs elemental resistance per point, weighted by element', () => {
      seedContent([
        ensureItem({
          ...plainMaterial,
          infusionElementalResistances: { ...defaultAffinities(), Fire: 5 },
        }),
      ]);

      expect(infusionMaterialCost(plainMaterial.id)).toBe(
        GOLD_PER_ELEMENT_RESIST_POINT * 5 * VALUE_MULTIPLIER_PER_ELEMENT.Fire,
      );
    });

    it('costs 0 when the item has no infusionStats', () => {
      expect(infusionMaterialCost(plainMaterial.id)).toBe(0);
    });

    // fangShard grants +10 Beast damage; VALUE_MULTIPLIER_PER_MONSTER_TYPE.Beast is 5, GOLD_PER_MONSTER_TYPE_DAMAGE_POINT is 50: 50 * 10 * 5 = 2500g.
    it('costs GOLD_PER_MONSTER_TYPE_DAMAGE_POINT per point, scaled by VALUE_MULTIPLIER_PER_MONSTER_TYPE for the type', () => {
      expect(infusionMaterialCost(fangShard.id)).toBe(2500);
    });

    // woodShard grants +1 Woodworking yield; GOLD_PER_GATHER_YIELD_POINT is 200, no per-tradeskill weighting: 200 * 1 = 200g.
    it('costs GOLD_PER_GATHER_YIELD_POINT per point of GatherYield value, unweighted', () => {
      expect(infusionMaterialCost(woodShard.id)).toBe(200);
    });
  });

  describe('canInfuseEquipmentItem', () => {
    beforeEach(() => {
      stock(1000, 6600);
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
      expect(canInfuseEquipmentItem(swordItem, 0, plainMaterial.id)).toBe(
        false,
      );
    });

    it('allows a resistance-only material (no infusionStats)', () => {
      expect(canInfuseEquipmentItem(swordItem, 0, spiritFlesh.id)).toBe(true);
    });

    it('allows a combat-stat-only material (no infusionStats)', () => {
      expect(canInfuseEquipmentItem(swordItem, 0, vengeanceShard.id)).toBe(
        true,
      );
    });

    it('allows a monster-type-damage-only material (no infusionStats)', () => {
      expect(canInfuseEquipmentItem(swordItem, 0, fangShard.id)).toBe(true);
    });

    it('allows a gather-yield-only material (no infusionStats)', () => {
      expect(canInfuseEquipmentItem(swordItem, 0, woodShard.id)).toBe(true);
    });

    it('rejects when the player does not own the material', () => {
      stock(0, 6600);
      expect(canInfuseEquipmentItem(swordItem, 0, crystal.id)).toBe(false);
    });

    it('rejects when the player cannot afford the gold cost', () => {
      stock(1000, 0);
      expect(canInfuseEquipmentItem(swordItem, 0, crystal.id)).toBe(false);
    });
  });
});
