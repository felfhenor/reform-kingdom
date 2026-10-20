import {
  VALID_AFFIX_POSITIONS,
  VALID_COMBAT_STATS,
  VALID_EQUIPMENT_ITEM_TYPES,
  VALID_EQUIPMENT_SLOTS,
  VALID_GAME_STATS,
  VALID_GAME_ELEMENTS,
  VALID_MONSTER_TYPES,
  VALID_STATUS_EFFECT_TAGS,
} from '@helpers/content/ensure-helpers-constants';
import {
  ensureArray,
  ensureEnumValue,
} from '@helpers/content/ensure-helpers-core';
import { ensureSkillStatBonus } from '@helpers/content/ensure-helpers-stats';
import { ensureSkillModifierEffect } from '@helpers/content/ensure-skill-modifier';
import type {
  AffixContent,
  AffixEffect,
  AffixId,
  EquipmentSkillId,
  HeroEffect,
  JobAbilityId,
  TradeskillId,
} from '@interfaces';

export function ensureAffixEffect(
  effect: Record<string, unknown> = {},
): AffixEffect {
  const kind = effect['kind'] as AffixEffect['kind'];
  const value = (effect['value'] as number) ?? 0;

  switch (kind) {
    case 'Resistance':
      return {
        kind: 'Resistance',
        tag: ensureEnumValue(effect['tag'], VALID_STATUS_EFFECT_TAGS, 'Stun'),
        value,
      };
    case 'InfusionSlot':
      return {
        kind: 'InfusionSlot',
        value: effect['value'] === undefined ? 1 : value,
      };
    case 'GrantSkill':
      return {
        kind: 'GrantSkill',
        skillId:
          (effect['skillId'] as EquipmentSkillId) ??
          ('UNKNOWN' as EquipmentSkillId),
      };
    case 'GatherYield':
      return {
        kind: 'GatherYield',
        tradeskillId:
          (effect['tradeskillId'] as TradeskillId) ??
          ('UNKNOWN' as TradeskillId),
        value,
      };
    case 'CombatStat':
      return {
        kind: 'CombatStat',
        stat: ensureEnumValue(
          effect['stat'],
          VALID_COMBAT_STATS,
          'repeatActionChance',
        ),
        value,
      };
    case 'SellValue':
      return { kind: 'SellValue', value };
    case 'CaravanBuyDiscount':
      return { kind: 'CaravanBuyDiscount', value };
    case 'CaravanSellBonus':
      return { kind: 'CaravanSellBonus', value };
    case 'MonsterTypeDamage':
      return {
        kind: 'MonsterTypeDamage',
        monsterType: ensureEnumValue(
          effect['monsterType'],
          VALID_MONSTER_TYPES,
          'Humanoid',
        ),
        value,
      };
    case 'ElementalResistance':
    case 'ElementalBoon':
      return {
        kind,
        element: ensureEnumValue(
          effect['element'],
          VALID_GAME_ELEMENTS,
          'Fire',
        ),
        value,
      };
    case 'ElementConversion':
      return {
        kind: 'ElementConversion',
        element: ensureEnumValue(
          effect['element'],
          VALID_GAME_ELEMENTS,
          'Fire',
        ),
      };
    case 'SkillStatBonus':
      return { kind: 'SkillStatBonus', ...ensureSkillStatBonus(effect) };
    case 'Stat':
    default:
      return {
        kind: 'Stat',
        stat: ensureEnumValue(effect['stat'], VALID_GAME_STATS, 'Strength'),
        value,
      };
  }
}

// Skill-tree-only kinds first, so they never fall through to the affix default.
export function ensureHeroEffect(
  effect: Record<string, unknown> = {},
): HeroEffect {
  const value = (effect['value'] as number) ?? 0;

  switch (effect['kind']) {
    case 'StatPerLevel':
      return {
        kind: 'StatPerLevel',
        stat: ensureEnumValue(effect['stat'], VALID_GAME_STATS, 'Strength'),
        value,
      };
    case 'JobAbility':
      return {
        kind: 'JobAbility',
        jobAbilityId: (effect['jobAbilityId'] as JobAbilityId) ?? 'UNKNOWN',
        value,
      };
    case 'DebuffPotency':
      return {
        kind: 'DebuffPotency',
        chance: (effect['chance'] as number) ?? 0,
        duration: (effect['duration'] as number) ?? 0,
      };
    case 'SkillModifier':
      return ensureSkillModifierEffect(effect);
    default:
      return ensureAffixEffect(effect);
  }
}

export function ensureAffix(
  affix: Partial<AffixContent>,
): Required<AffixContent> {
  return {
    id: affix.id ?? ('UNKNOWN' as AffixId),
    name: affix.name ?? 'UNKNOWN',
    __type: 'affix',
    description: affix.description ?? 'UNKNOWN',
    rarity: affix.rarity ?? 'Common',
    family: affix.family ?? 'UNKNOWN',
    position: ensureEnumValue(affix.position, VALID_AFFIX_POSITIONS, 'Suffix'),
    levelRequirement: affix.levelRequirement ?? 1,
    effects: ensureArray(affix.effects, ensureAffixEffect),
    fluxOnly: affix.fluxOnly ?? false,
    gearSlots: ensureArray(affix.gearSlots, (slot) =>
      ensureEnumValue(slot, VALID_EQUIPMENT_SLOTS, 'Weapon'),
    ),
    gearTypes: ensureArray(affix.gearTypes, (type) =>
      ensureEnumValue(type, VALID_EQUIPMENT_ITEM_TYPES, 'Sword'),
    ),
  };
}
