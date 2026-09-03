import {
  VALID_AFFIX_POSITIONS,
  VALID_COMBAT_STATS,
  VALID_GAME_STATS,
  VALID_STATUS_EFFECT_TAGS,
} from '@helpers/content/ensure-helpers-constants';
import {
  ensureArray,
  ensureEnumValue,
} from '@helpers/content/ensure-helpers-core';
import type {
  AffixContent,
  AffixEffect,
  AffixId,
  EquipmentSkillId,
  TradeskillId,
} from '../../interfaces';

function ensureAffixEffect(effect: Record<string, unknown> = {}): AffixEffect {
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
    case 'Stat':
    default:
      return {
        kind: 'Stat',
        stat: ensureEnumValue(effect['stat'], VALID_GAME_STATS, 'Strength'),
        value,
      };
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
    effects: ensureArray(affix.effects, ensureAffixEffect),
  };
}
