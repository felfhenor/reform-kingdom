import { defaultStats, defaultTagResistances } from '@helpers/defaults';
import {
  affixEffectsOfKind,
  affixEffectSum,
  equipmentItemAffixEffects,
} from '@helpers/item/affix';
import {
  equipmentItemInfusionBonus,
  equipmentItemInfusionResistanceBonus,
} from '@helpers/item/infusion';
import type {
  EquipmentContent,
  EquipmentItem,
  EquipmentSkillId,
  StatBlock,
  StatusEffectTag,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// Combines infusion + affix Stat bonuses into one block, for the "green bonus rows" UI components already show under an item's base stats.
export function equipmentItemBonusStats(item: EquipmentItem): StatBlock {
  const infusion = equipmentItemInfusionBonus(item.infusedItemIds);
  const affixEffects = equipmentItemAffixEffects(item);
  const combined = defaultStats();

  (Object.keys(combined) as Array<keyof StatBlock>).forEach((stat) => {
    const affixBonus = affixEffectSum(
      affixEffects,
      'Stat',
      (effect) => effect.stat === stat,
    );
    combined[stat] = infusion[stat] + affixBonus;
  });

  return combined;
}

// The resistance analog of `equipmentItemBonusStats`.
export function equipmentItemBonusResistances(
  item: EquipmentItem,
): Record<StatusEffectTag, number> {
  const infusion = equipmentItemInfusionResistanceBonus(item.infusedItemIds);
  const affixEffects = equipmentItemAffixEffects(item);
  const combined = defaultTagResistances();

  (Object.keys(combined) as StatusEffectTag[]).forEach((tag) => {
    const affixBonus = affixEffectSum(
      affixEffects,
      'Resistance',
      (effect) => effect.tag === tag,
    );
    combined[tag] = infusion[tag] + affixBonus;
  });

  return combined;
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
