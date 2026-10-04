import { seedContent } from '@/testing/content';
import { buildEquipmentItem } from '@/testing/builders';
import {
  equipmentItemBonusCombatStats,
  equipmentItemBonusMonsterTypeDamage,
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
  equipmentItemGrantedSkillIds,
} from '@helpers/item/equipment-display';
import type {
  AffixId,
  EquipmentId,
  EquipmentItem,
  EquipmentSkillId,
  ItemId,
} from '@interfaces';
import { describe, expect, it } from 'vitest';
import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { defaultStats, defaultCombatStats } from '@helpers/defaults';

const strengthAffix = ensureAffix({
  id: 'affix-str' as AffixId,
  name: 'of Strength',
  levelRequirement: 1,
  description: '',
  rarity: 'Common',
  family: 'Strength',
  position: 'Suffix',
  effects: [{ kind: 'Stat', stat: 'Strength', value: 4 }],
});

const stunAffix = ensureAffix({
  id: 'affix-stun' as AffixId,
  name: 'of Steadfastness',
  levelRequirement: 1,
  description: '',
  rarity: 'Uncommon',
  family: 'StunResist',
  position: 'Suffix',
  effects: [{ kind: 'Resistance', tag: 'Stun', value: 10 }],
});

const grantAffix = ensureAffix({
  id: 'affix-grant' as AffixId,
  name: 'of Aggression',
  levelRequirement: 1,
  description: '',
  rarity: 'Mystical',
  family: 'GrantAttack',
  position: 'Suffix',
  effects: [{ kind: 'GrantSkill', skillId: 'attack' as EquipmentSkillId }],
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

const vengeanceShard = ensureItem({
  id: 'vengeance-shard' as ItemId,
  name: 'Vengeance Shard',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  infusionCombatStats: { ...defaultCombatStats(), damageReflectPercent: 3 },
});

const crystal = ensureItem({
  id: 'crystal' as ItemId,
  name: 'Minor Crystal',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  infusionStats: { ...defaultStats(), Strength: 2 },
});

function buildItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return buildEquipmentItem('sword' as EquipmentId, overrides);
}

describe('equipmentItemBonusStats', () => {
  it('is zeroed when the item has no infusions or affixes', () => {
    expect(equipmentItemBonusStats(buildItem()).Strength).toBe(0);
  });

  it('includes an affix Stat bonus', () => {
    seedContent([strengthAffix]);

    const bonus = equipmentItemBonusStats(
      buildItem({ affixIds: [strengthAffix.id] }),
    );
    expect(bonus.Strength).toBe(4);
  });

  it('sums infusion and affix bonuses to the same stat', () => {
    seedContent([strengthAffix, crystal]);

    const bonus = equipmentItemBonusStats(
      buildItem({
        infusedItemIds: [crystal.id],
        affixIds: [strengthAffix.id],
      }),
    );
    expect(bonus.Strength).toBe(6);
  });
});

describe('equipmentItemBonusResistances', () => {
  it('is zeroed when the item has no affixes', () => {
    expect(equipmentItemBonusResistances(buildItem()).Stun).toBe(0);
  });

  it('includes an affix Resistance bonus', () => {
    seedContent([stunAffix]);

    const bonus = equipmentItemBonusResistances(
      buildItem({ affixIds: [stunAffix.id] }),
    );
    expect(bonus.Stun).toBe(10);
  });
});

describe('equipmentItemBonusCombatStats', () => {
  it('is zeroed when the item has no infusions or affixes', () => {
    expect(
      equipmentItemBonusCombatStats(buildItem()).damageReflectPercent,
    ).toBe(0);
  });

  it('includes an affix CombatStat bonus', () => {
    seedContent([reflectAffix]);

    const bonus = equipmentItemBonusCombatStats(
      buildItem({ affixIds: [reflectAffix.id] }),
    );
    expect(bonus.damageReflectPercent).toBe(5);
  });

  it('sums infusion and affix bonuses to the same combat stat', () => {
    seedContent([reflectAffix, vengeanceShard]);

    const bonus = equipmentItemBonusCombatStats(
      buildItem({
        infusedItemIds: [vengeanceShard.id],
        affixIds: [reflectAffix.id],
      }),
    );
    expect(bonus.damageReflectPercent).toBe(8);
  });
});

const demonSlayingAffix = ensureAffix({
  id: 'affix-demon-slaying' as AffixId,
  name: 'Demon-slaying',
  levelRequirement: 1,
  description: '',
  rarity: 'Uncommon',
  family: 'DemonSlaying',
  position: 'Prefix',
  effects: [{ kind: 'MonsterTypeDamage', monsterType: 'Demon', value: 20 }],
});

describe('equipmentItemBonusMonsterTypeDamage', () => {
  it('is zeroed when the item has no affixes', () => {
    expect(equipmentItemBonusMonsterTypeDamage(buildItem()).Demon).toBe(0);
  });

  it('includes an affix MonsterTypeDamage bonus', () => {
    seedContent([demonSlayingAffix]);

    const bonus = equipmentItemBonusMonsterTypeDamage(
      buildItem({ affixIds: [demonSlayingAffix.id] }),
    );
    expect(bonus.Demon).toBe(20);
  });
});

describe('equipmentItemGrantedSkillIds', () => {
  const content = ensureEquipment({
    id: 'sword' as EquipmentId,
    name: 'Sword',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    levelRequirement: 1,
    baseStats: { ...defaultStats() },
    type: 'Sword',
    slots: 0,
    grantedSkillIds: ['starshine-2' as EquipmentSkillId],
  });

  it('combines content-granted and affix-granted skills', () => {
    seedContent([grantAffix]);

    const skillIds = equipmentItemGrantedSkillIds(
      buildItem({ affixIds: [grantAffix.id] }),
      content,
    );
    expect(skillIds).toEqual(['starshine-2', 'attack']);
  });

  it('dedupes a skill granted by both content and an affix', () => {
    const duplicateGrantAffix = ensureAffix({
      ...grantAffix,
      effects: [
        { kind: 'GrantSkill', skillId: 'starshine-2' as EquipmentSkillId },
      ],
    });
    seedContent([duplicateGrantAffix]);

    const skillIds = equipmentItemGrantedSkillIds(
      buildItem({ affixIds: [duplicateGrantAffix.id] }),
      content,
    );
    expect(skillIds).toEqual(['starshine-2']);
  });

  it('returns just the content-granted skills when the item has no affixes', () => {
    const skillIds = equipmentItemGrantedSkillIds(buildItem(), content);
    expect(skillIds).toEqual(['starshine-2']);
  });
});
