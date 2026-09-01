vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import {
  COMBAT_STAT_BONUS,
  equipmentItemBonusTotals,
  equipmentItemInfusionTotals,
} from '@helpers/item/equipment-bonus';
import type {
  AffixContent,
  AffixId,
  EquipmentItem,
  EquipmentItemId,
  EquipmentId,
  ItemContent,
  ItemId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reflectShard: ItemContent = {
  id: 'reflect-shard' as ItemId,
  name: 'Reflect Shard',
  __type: 'item',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  infusionCombatStats: {
    repeatActionChance: 0,
    skillStrikeAgainChance: 0,
    redirectionChance: 0,
    missChance: 0,
    debuffIgnoreChance: 0,
    damageReflectPercent: 2,
    healingIgnorePercent: 0,
    reviveChance: 0,
    stunChance: 0,
    agroValue: 0,
  },
};

const reflectAffix: AffixContent = {
  id: 'affix-reflect' as AffixId,
  name: 'of Reflection',
  __type: 'affix',
  description: '',
  rarity: 'Rare',
  family: 'DamageReflect',
  position: 'Suffix',
  effects: [{ kind: 'CombatStat', stat: 'damageReflectPercent', value: 5 }],
};

function buildItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'item-1' as EquipmentItemId,
    equipmentId: 'sword' as EquipmentId,
    infusedItemIds: [],
    affixIds: [],
    ...overrides,
  };
}

describe('equipmentItemInfusionTotals', () => {
  beforeEach(() => {
    vi.mocked(getEntry).mockImplementation(
      (id) => (id === reflectShard.id ? reflectShard : undefined) as never,
    );
  });

  it('sums the dimension block of every non-null slot', () => {
    const bonus = equipmentItemInfusionTotals(
      [reflectShard.id, reflectShard.id],
      COMBAT_STAT_BONUS,
    );
    expect(bonus.damageReflectPercent).toBe(4);
  });

  it('skips null (empty) slots', () => {
    const bonus = equipmentItemInfusionTotals(
      [reflectShard.id, null],
      COMBAT_STAT_BONUS,
    );
    expect(bonus.damageReflectPercent).toBe(2);
  });

  it('skips ids that resolve to no content or no block for this dimension', () => {
    const bonus = equipmentItemInfusionTotals(
      ['missing' as ItemId],
      COMBAT_STAT_BONUS,
    );
    expect(bonus.damageReflectPercent).toBe(0);
  });

  it('returns the dimension default for an empty array', () => {
    const bonus = equipmentItemInfusionTotals([], COMBAT_STAT_BONUS);
    expect(bonus.damageReflectPercent).toBe(0);
  });
});

describe('equipmentItemBonusTotals', () => {
  it('combines infusion and affix bonuses for the same dimension', () => {
    vi.mocked(getEntry).mockImplementation((id) => {
      if (id === reflectShard.id) return reflectShard as never;
      if (id === reflectAffix.id) return reflectAffix as never;
      return undefined as never;
    });

    const bonus = equipmentItemBonusTotals(
      buildItem({
        infusedItemIds: [reflectShard.id],
        affixIds: [reflectAffix.id],
      }),
      COMBAT_STAT_BONUS,
    );
    expect(bonus.damageReflectPercent).toBe(7);
  });

  it('is zeroed when the item has no infusions or affixes', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    const bonus = equipmentItemBonusTotals(buildItem(), COMBAT_STAT_BONUS);
    expect(bonus.damageReflectPercent).toBe(0);
  });
});
