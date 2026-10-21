import { affixEffectsOfKind, equipmentItemAffixes } from '@helpers/item/affix';
import {
  affixEffectsHaveStatSummary,
  affixEffectsStatSummary,
  STAT_SUMMARY_EFFECT_KINDS,
} from '@helpers/item/equipment-bonus';
import {
  resolveGatherYieldBonusDisplay,
  resolveSkillStatBonusDisplay,
} from '@helpers/item/item-preview';
import type {
  AffixContent,
  AffixDisplay,
  EquipmentItem,
  HeroEffect,
} from '@interfaces';

const AFFIX_KINDS_WITH_STAT_ROW = new Set<HeroEffect['kind']>([
  ...STAT_SUMMARY_EFFECT_KINDS,
  'GatherYield',
  'SkillStatBonus',
]);

export function affixDisplay(affix: AffixContent): AffixDisplay {
  const { effects } = affix;
  const needsDescription = effects.some(
    (effect) => !AFFIX_KINDS_WITH_STAT_ROW.has(effect.kind),
  );

  return {
    id: affix.id,
    name: affix.name,
    rarity: affix.rarity,
    position: affix.position,
    ...affixEffectsStatSummary(effects),
    hasStatRow: affixEffectsHaveStatSummary(effects),
    gatherYieldBonuses: resolveGatherYieldBonusDisplay(
      affixEffectsOfKind(effects, 'GatherYield'),
    ),
    skillStatBonuses: resolveSkillStatBonusDisplay(
      affixEffectsOfKind(effects, 'SkillStatBonus'),
    ),
    description: needsDescription ? affix.description : undefined,
  };
}

export function equipmentItemAffixDisplays(
  item: EquipmentItem,
): AffixDisplay[] {
  return equipmentItemAffixes(item).map(affixDisplay);
}
