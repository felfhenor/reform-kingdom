import { getEntry } from '@helpers/content/content';
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
  EquipmentSkillContent,
  EquipmentSkillId,
  StatBlock,
  StatusEffectBlock,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// Combines infusion + affix Stat bonuses into one block, for the "green bonus rows" UI components already show under an item's base stats.
export function equipmentItemBonusStats(item: EquipmentItem): StatBlock {
  return equipmentItemBonusTotals(item, STAT_BONUS);
}

// The resistance analog of `equipmentItemBonusStats`.
export function equipmentItemBonusResistances(
  item: EquipmentItem,
): StatusEffectBlock {
  return equipmentItemBonusTotals(item, RESISTANCE_BONUS);
}

// The combat-stat analog of `equipmentItemBonusStats`.
export function equipmentItemBonusCombatStats(
  item: EquipmentItem,
): CombatStatBlock {
  return equipmentItemBonusTotals(item, COMBAT_STAT_BONUS);
}

// Base + bonus combined - the comparison baseline for diffing a candidate item against what's equipped.
export function equipmentItemTotalStats(
  item: EquipmentItem,
  content: EquipmentContent,
): StatBlock {
  const bonus = equipmentItemBonusStats(item);
  const total = { ...content.baseStats };

  (Object.keys(total) as Array<keyof StatBlock>).forEach((stat) => {
    total[stat] += bonus[stat];
  });

  return total;
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

// Resolves `equipmentItemGrantedSkillIds` to their skill content, dropping any id that no longer resolves.
export function equipmentItemGrantedSkills(
  item: EquipmentItem,
  content: EquipmentContent,
): EquipmentSkillContent[] {
  return equipmentItemGrantedSkillIds(item, content)
    .map((skillId) => getEntry<EquipmentSkillContent>(skillId))
    .filter((skill): skill is EquipmentSkillContent => !!skill);
}
