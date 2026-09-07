import {
  affixEffectsOfKind,
  equipmentItemAffixEffects,
} from '@helpers/item/affix';
import {
  COMBAT_STAT_BONUS,
  equipmentItemBonusTotals,
  RESISTANCE_BONUS,
  STAT_BONUS,
} from '@helpers/item/equipment-bonus';
import type {
  CombatStatBlock,
  EquipmentContent,
  EquipmentItem,
  EquipmentSkillId,
  StatBlock,
  StatusEffectBlock,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// Combines infusion + affix Stat bonuses into one block, for the "green bonus rows" UI components already show under an item's base stats.
export function equipmentItemBonusStats(item: EquipmentItem): StatBlock {
  return equipmentItemBonusTotals(item, STAT_BONUS);
}

export function equipmentItemBonusResistances(
  item: EquipmentItem,
): StatusEffectBlock {
  return equipmentItemBonusTotals(item, RESISTANCE_BONUS);
}

export function equipmentItemBonusCombatStats(
  item: EquipmentItem,
): CombatStatBlock {
  return equipmentItemBonusTotals(item, COMBAT_STAT_BONUS);
}

// Content-granted skills plus any GrantSkill affix rolled on this specific item, deduped.
export function equipmentItemGrantedSkillIds(
  item: EquipmentItem,
  content: EquipmentContent,
): EquipmentSkillId[] {
  const affixSkillIds = affixEffectsOfKind(
    equipmentItemAffixEffects(item),
    'GrantSkill',
  ).map((effect) => effect.skillId);

  return uniq([...content.grantedSkillIds, ...affixSkillIds]);
}
