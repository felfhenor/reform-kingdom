import {
  defaultCombatStats,
  defaultMonsterTypeDamageBonus,
  defaultStats,
} from '@helpers/defaults';
import {
  affixEffectsAddToBlock,
  COMBAT_STAT_BONUS,
  equipmentItemBonusTotals,
  equipmentItemGatherYieldBonuses,
  equipmentItemInfusionGatherYieldBonuses,
  equipmentItemInfusionTotals,
  equipmentItemSkillStatBonuses,
  MONSTER_TYPE_DAMAGE_BONUS,
  weightedBlockTotal,
} from '@helpers/item/equipment-bonus';
import type {
  AffixId,
  EquipmentId,
  EquipmentItem,
  ItemId,
  TradeskillId,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';

import { seedContent } from '@/testing/content';
import { buildEquipmentItem } from '@/testing/builders';

const reflectShard = ensureItem({
  id: 'reflect-shard' as ItemId,
  name: 'Reflect Shard',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  infusionCombatStats: { ...defaultCombatStats(), damageReflectPercent: 2 },
});

const reflectAffix = ensureAffix({
  id: 'affix-reflect' as AffixId,
  name: 'of Reflection',
  levelRequirement: 1,
  description: '',
  rarity: 'Rare',
  family: 'DamageReflect',
  position: 'Suffix',
  effects: [{ kind: 'CombatStat', stat: 'damageReflectPercent', value: 5 }],
});

function buildItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return buildEquipmentItem('sword' as EquipmentId, overrides);
}

describe('equipmentItemInfusionTotals', () => {
  beforeEach(() => {
    seedContent([reflectShard]);
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
    seedContent([reflectShard, reflectAffix]);

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
    seedContent([]);

    const bonus = equipmentItemBonusTotals(buildItem(), COMBAT_STAT_BONUS);
    expect(bonus.damageReflectPercent).toBe(0);
  });
});

describe('MONSTER_TYPE_DAMAGE_BONUS.infusionBlock', () => {
  it("reads the item's infusionMonsterTypeDamage block", () => {
    const fangShard = ensureItem({
      id: 'fang-shard' as ItemId,
      name: 'Fang Shard',
      description: '',
      sprite: '0000',
      rarity: 'Common',
      infusionMonsterTypeDamage: {
        ...defaultMonsterTypeDamageBonus(),
        Beast: 10,
      },
    });

    expect(MONSTER_TYPE_DAMAGE_BONUS.infusionBlock(fangShard)).toEqual(
      fangShard.infusionMonsterTypeDamage,
    );
  });

  it('sums into equipmentItemInfusionTotals like any other dimension', () => {
    const fangShard = ensureItem({
      id: 'fang-shard' as ItemId,
      name: 'Fang Shard',
      description: '',
      sprite: '0000',
      rarity: 'Common',
      infusionMonsterTypeDamage: {
        ...defaultMonsterTypeDamageBonus(),
        Beast: 10,
      },
    });
    seedContent([fangShard]);

    const bonus = equipmentItemInfusionTotals(
      [fangShard.id, fangShard.id],
      MONSTER_TYPE_DAMAGE_BONUS,
    );
    expect(bonus.Beast).toBe(20);
  });
});

describe('equipmentItemInfusionGatherYieldBonuses', () => {
  const woodShard = ensureItem({
    id: 'wood-shard' as ItemId,
    name: 'Wood Shard',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    infusionGatherYieldBonuses: [
      { tradeskillId: 'Woodworking' as TradeskillId, value: 1 },
    ],
  });

  beforeEach(() => {
    seedContent([woodShard]);
  });

  it('sums infusionGatherYieldBonuses of every non-null slot', () => {
    expect(
      equipmentItemInfusionGatherYieldBonuses([woodShard.id, woodShard.id]),
    ).toEqual([
      { tradeskillId: 'Woodworking', value: 1 },
      { tradeskillId: 'Woodworking', value: 1 },
    ]);
  });

  it('skips null (empty) slots', () => {
    expect(
      equipmentItemInfusionGatherYieldBonuses([woodShard.id, null]),
    ).toEqual([{ tradeskillId: 'Woodworking', value: 1 }]);
  });

  it('skips ids that resolve to no content or no infusionGatherYieldBonuses', () => {
    expect(
      equipmentItemInfusionGatherYieldBonuses(['missing' as ItemId]),
    ).toEqual([]);
  });

  it('returns an empty array for an empty input', () => {
    expect(equipmentItemInfusionGatherYieldBonuses([])).toEqual([]);
  });
});

const woodworkingYieldAffix = ensureAffix({
  id: 'affix-woodworking-yield' as AffixId,
  name: 'of the Wooden',
  levelRequirement: 1,
  description: '',
  rarity: 'Uncommon',
  family: 'WoodworkingYield',
  position: 'Suffix',
  effects: [
    {
      kind: 'GatherYield',
      tradeskillId: 'Woodworking' as TradeskillId,
      value: 1,
    },
  ],
});

describe('equipmentItemGatherYieldBonuses', () => {
  const woodworkingTrinket = ensureEquipment({
    id: 'trinket' as EquipmentId,
    name: 'Trinket',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    levelRequirement: 1,
    baseStats: { ...defaultStats() },
    type: 'Trinket',
    slots: 0,
    grantedSkillIds: [],
    gatherYieldBonuses: [
      { tradeskillId: 'Woodworking' as TradeskillId, value: 1 },
      { tradeskillId: 'Blacksmithing' as TradeskillId, value: 1 },
    ],
  });

  it('returns just the base bonuses when the item has no rolled affixes', () => {
    expect(
      equipmentItemGatherYieldBonuses(woodworkingTrinket, buildItem()),
    ).toEqual([
      { tradeskillId: 'Woodworking', value: 1 },
      { tradeskillId: 'Blacksmithing', value: 1 },
    ]);
  });

  it('returns just the base bonuses when no instance is given', () => {
    expect(equipmentItemGatherYieldBonuses(woodworkingTrinket)).toEqual([
      { tradeskillId: 'Woodworking', value: 1 },
      { tradeskillId: 'Blacksmithing', value: 1 },
    ]);
  });

  it('merges a rolled GatherYield affix into the matching base tradeskill', () => {
    seedContent([woodworkingYieldAffix]);

    const bonuses = equipmentItemGatherYieldBonuses(
      woodworkingTrinket,
      buildItem({ affixIds: [woodworkingYieldAffix.id] }),
    );

    expect(bonuses).toEqual([
      { tradeskillId: 'Woodworking', value: 2 },
      { tradeskillId: 'Blacksmithing', value: 1 },
    ]);
  });

  it('returns an empty array for a content entry with no gatherYieldBonuses', () => {
    expect(
      equipmentItemGatherYieldBonuses(
        { ...woodworkingTrinket, gatherYieldBonuses: undefined },
        buildItem(),
      ),
    ).toEqual([]);
  });

  it('merges an infused GatherYield material into the matching base tradeskill', () => {
    const woodShard = ensureItem({
      id: 'wood-shard' as ItemId,
      name: 'Wood Shard',
      description: '',
      sprite: '0000',
      rarity: 'Common',
      infusionGatherYieldBonuses: [
        { tradeskillId: 'Woodworking' as TradeskillId, value: 3 },
      ],
    });
    seedContent([woodShard]);

    const bonuses = equipmentItemGatherYieldBonuses(
      woodworkingTrinket,
      buildItem({ infusedItemIds: [woodShard.id] }),
    );

    expect(bonuses).toEqual([
      { tradeskillId: 'Woodworking', value: 4 },
      { tradeskillId: 'Blacksmithing', value: 1 },
    ]);
  });

  it('combines base, infusion, and affix bonuses for the same tradeskill', () => {
    const woodShard = ensureItem({
      id: 'wood-shard' as ItemId,
      name: 'Wood Shard',
      description: '',
      sprite: '0000',
      rarity: 'Common',
      infusionGatherYieldBonuses: [
        { tradeskillId: 'Woodworking' as TradeskillId, value: 3 },
      ],
    });
    seedContent([woodShard, woodworkingYieldAffix]);

    const bonuses = equipmentItemGatherYieldBonuses(
      woodworkingTrinket,
      buildItem({
        infusedItemIds: [woodShard.id],
        affixIds: [woodworkingYieldAffix.id],
      }),
    );

    expect(bonuses).toEqual([
      { tradeskillId: 'Woodworking', value: 5 },
      { tradeskillId: 'Blacksmithing', value: 1 },
    ]);
  });
});

describe('weightedBlockTotal', () => {
  it('sums each key weighted by the matching multiplier', () => {
    const total = weightedBlockTotal({ a: 2, b: 3 }, { a: 5, b: 10 } as Record<
      'a' | 'b',
      number
    >);
    expect(total).toBe(2 * 5 + 3 * 10);
  });

  it('treats a missing block key as 0', () => {
    const total = weightedBlockTotal({ a: 2 }, { a: 5, b: 10 } as Record<
      'a' | 'b',
      number
    >);
    expect(total).toBe(2 * 5);
  });

  it('is 0 for an undefined block', () => {
    const total = weightedBlockTotal(undefined, {
      a: 5,
      b: 10,
    } as Record<'a' | 'b', number>);
    expect(total).toBe(0);
  });
});

describe('equipmentItemSkillStatBonuses', () => {
  const fireballStaff = ensureEquipment({
    id: 'staff' as EquipmentId,
    name: 'Staff',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    levelRequirement: 1,
    type: 'Staff',
    slots: 1,
    grantedSkillIds: [],
    skillStatBonuses: [{ skillFamily: 'Fireball', stat: 'Vitality', value: 2 }],
  });

  const fireballAffix = ensureAffix({
    id: 'affix-fireball' as AffixId,
    name: 'Blazing',
    levelRequirement: 1,
    description: '',
    rarity: 'Uncommon',
    family: 'Skill Enhancement',
    position: 'Prefix',
    effects: [
      {
        kind: 'SkillStatBonus',
        skillFamily: 'Fireball',
        stat: 'Vitality',
        value: 0.5,
      },
      {
        kind: 'SkillStatBonus',
        skillFamily: 'Fireball',
        stat: 'Agility',
        value: 0.25,
      },
    ],
  });

  const fireballShard = ensureItem({
    id: 'fireball-shard' as ItemId,
    name: 'Fireball Shard',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    infusionSkillStatBonuses: [
      { skillFamily: 'Fireball', stat: 'Vitality', value: 1 },
    ],
  });

  function buildStaffItem(
    overrides: Partial<EquipmentItem> = {},
  ): EquipmentItem {
    return buildEquipmentItem(fireballStaff.id, overrides);
  }

  it('returns just the base bonuses for a bare content entry', () => {
    expect(equipmentItemSkillStatBonuses(fireballStaff)).toEqual([
      { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
    ]);
  });

  it('merges base, infusion and affix grants of the same family and stat into one entry', () => {
    seedContent([fireballShard, fireballAffix]);

    const bonuses = equipmentItemSkillStatBonuses(
      fireballStaff,
      buildStaffItem({
        infusedItemIds: [fireballShard.id],
        affixIds: [fireballAffix.id],
      }),
    );

    expect(bonuses).toEqual([
      { skillFamily: 'Fireball', stat: 'Vitality', value: 3.5 },
      { skillFamily: 'Fireball', stat: 'Agility', value: 0.25 },
    ]);
  });

  it('keeps different stats of one family as separate entries', () => {
    seedContent([fireballAffix]);

    const bonuses = equipmentItemSkillStatBonuses(
      { ...fireballStaff, skillStatBonuses: [] },
      buildStaffItem({ affixIds: [fireballAffix.id] }),
    );

    expect(bonuses.map((bonus) => bonus.stat)).toEqual(['Vitality', 'Agility']);
  });

  it('returns an empty list when nothing grants a bonus', () => {
    expect(
      equipmentItemSkillStatBonuses({
        ...fireballStaff,
        skillStatBonuses: undefined,
      }),
    ).toEqual([]);
  });
});

describe('affixEffectsAddToBlock', () => {
  it('adds matching effects onto a copy of the block', () => {
    const block = { ...defaultCombatStats(), damageReflectPercent: 2 };

    const combined = affixEffectsAddToBlock(
      block,
      [
        { kind: 'CombatStat', stat: 'damageReflectPercent', value: 1 },
        { kind: 'Stat', stat: 'Luck', value: 5 },
      ],
      COMBAT_STAT_BONUS,
    );

    expect(combined.damageReflectPercent).toBe(3);
    expect(block.damageReflectPercent).toBe(2);
  });
});
