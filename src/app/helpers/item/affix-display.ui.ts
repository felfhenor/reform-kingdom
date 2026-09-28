import {
  defaultCombatStats,
  defaultMonsterTypeDamageBonus,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import { affixEffectsOfKind, equipmentItemAffixes } from '@helpers/item/affix';
import {
  affixEffectsAddToBlock,
  COMBAT_STAT_BONUS,
  MONSTER_TYPE_DAMAGE_BONUS,
  RESISTANCE_BONUS,
  STAT_BONUS,
} from '@helpers/item/equipment-bonus';
import {
  resolveGatherYieldBonusDisplay,
  resolveSkillStatBonusDisplay,
} from '@helpers/item/item-preview';
import type {
  AffixContent,
  AffixDisplay,
  AffixEffect,
  EquipmentItem,
} from '@interfaces';

const AFFIX_KINDS_IN_STAT_SUMMARY = new Set<AffixEffect['kind']>([
  'Stat',
  'CombatStat',
  'Resistance',
  'MonsterTypeDamage',
]);

const AFFIX_KINDS_WITH_STAT_ROW = new Set<AffixEffect['kind']>([
  ...AFFIX_KINDS_IN_STAT_SUMMARY,
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
    stats: affixEffectsAddToBlock(defaultStats(), effects, STAT_BONUS),
    resistances: affixEffectsAddToBlock(
      defaultTagResistances(),
      effects,
      RESISTANCE_BONUS,
    ),
    combatStats: affixEffectsAddToBlock(
      defaultCombatStats(),
      effects,
      COMBAT_STAT_BONUS,
    ),
    monsterTypeDamage: affixEffectsAddToBlock(
      defaultMonsterTypeDamageBonus(),
      effects,
      MONSTER_TYPE_DAMAGE_BONUS,
    ),
    hasStatRow: effects.some(
      (effect) =>
        AFFIX_KINDS_IN_STAT_SUMMARY.has(effect.kind) &&
        'value' in effect &&
        effect.value !== 0,
    ),
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
