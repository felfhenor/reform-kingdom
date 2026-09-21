import { getEntry } from '@helpers/content/content';
import {
  defaultCombatStats,
  defaultMonsterTypeDamageBonus,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import {
  affixEffectsOfKind,
  affixEffectSum,
  equipmentItemAffixEffects,
} from '@helpers/item/affix';
import type {
  CombatStatBlock,
  EquipmentBonusDimension,
  EquipmentContent,
  EquipmentItem,
  GatherYieldBonus,
  ItemContent,
  ItemId,
  MonsterType,
  SkillStatBonus,
  StatBlock,
  StatusEffectTag,
} from '@interfaces';
import { groupBy, sumBy } from 'es-toolkit/compat';

// One `EquipmentBonusDimension` per keyed numeric block gear can grant - a
// new dimension is just a new constant here, every function below is generic.
export const STAT_BONUS: EquipmentBonusDimension<keyof StatBlock> = {
  defaultBlock: defaultStats,
  equipmentBlock: (content) => content.baseStats,
  infusionBlock: (content) => content.infusionStats,
  affixBonusFor: (affixEffects, key) =>
    affixEffectSum(affixEffects, 'Stat', (effect) => effect.stat === key),
};

export const RESISTANCE_BONUS: EquipmentBonusDimension<StatusEffectTag> = {
  defaultBlock: defaultTagResistances,
  equipmentBlock: (content) => content.debuffResistances,
  infusionBlock: (content) => content.infusionDebuffResistances,
  affixBonusFor: (affixEffects, key) =>
    affixEffectSum(affixEffects, 'Resistance', (effect) => effect.tag === key),
};

export const COMBAT_STAT_BONUS: EquipmentBonusDimension<keyof CombatStatBlock> =
  {
    defaultBlock: defaultCombatStats,
    equipmentBlock: (content) => content.combatStats,
    infusionBlock: (content) => content.infusionCombatStats,
    affixBonusFor: (affixEffects, key) =>
      affixEffectSum(
        affixEffects,
        'CombatStat',
        (effect) => effect.stat === key,
      ),
  };

export const MONSTER_TYPE_DAMAGE_BONUS: EquipmentBonusDimension<MonsterType> = {
  defaultBlock: defaultMonsterTypeDamageBonus,
  equipmentBlock: (content) => content.monsterTypeDamage,
  infusionBlock: (content) => content.infusionMonsterTypeDamage,
  affixBonusFor: (affixEffects, key) =>
    affixEffectSum(
      affixEffects,
      'MonsterTypeDamage',
      (effect) => effect.monsterType === key,
    ),
};

// Sums one dimension's infusion bonus across every non-empty slot.
export function equipmentItemInfusionTotals<K extends string>(
  infusedItemIds: (ItemId | null)[],
  dimension: EquipmentBonusDimension<K>,
): Record<K, number> {
  const bonus = dimension.defaultBlock();

  infusedItemIds.forEach((itemId) => {
    if (!itemId) return;

    const content = getEntry<ItemContent>(itemId);
    const block = content && dimension.infusionBlock(content);
    if (!block) return;

    (Object.keys(bonus) as K[]).forEach((key) => {
      bonus[key] += block[key] ?? 0;
    });
  });

  return bonus;
}

// GatherYield/SkillStatBonus aren't fixed-key dimensions (TradeskillId/skill family are dynamic content), so they can't reuse `equipmentItemInfusionTotals` above.
function equipmentItemInfusionListBonuses<T>(
  infusedItemIds: (ItemId | null)[],
  listOf: (content: ItemContent) => T[] | undefined,
): T[] {
  return infusedItemIds.flatMap((itemId) => {
    if (!itemId) return [];
    const content = getEntry<ItemContent>(itemId);
    return (content && listOf(content)) ?? [];
  });
}

// Sums same-key entries so base, infusion and affix grants show as one row; callers strip the affix `kind` the spread carries over.
function mergeBonusesByKey<T extends { value: number }>(
  bonuses: T[],
  keyOf: (bonus: T) => string,
): T[] {
  return Object.values(groupBy(bonuses, keyOf)).map((group) => ({
    ...group[0],
    value: sumBy(group, (bonus) => bonus.value),
  }));
}

export function equipmentItemInfusionGatherYieldBonuses(
  infusedItemIds: (ItemId | null)[],
): GatherYieldBonus[] {
  return equipmentItemInfusionListBonuses(
    infusedItemIds,
    (content) => content.infusionGatherYieldBonuses,
  );
}

// Base (equipment content) plus infusion plus any rolled affix, merged by tradeskill - same "everything this item grants" shape as `equipmentItemBonusTotals` below, just array-based.
export function equipmentItemGatherYieldBonuses(
  content: EquipmentContent,
  item?: EquipmentItem,
): GatherYieldBonus[] {
  const infusionBonuses = item
    ? equipmentItemInfusionGatherYieldBonuses(item.infusedItemIds)
    : [];
  const affixBonuses = item
    ? affixEffectsOfKind(equipmentItemAffixEffects(item), 'GatherYield')
    : [];

  return mergeBonusesByKey(
    [
      ...(content.gatherYieldBonuses ?? []),
      ...infusionBonuses,
      ...affixBonuses,
    ],
    (bonus) => bonus.tradeskillId,
  ).map(({ tradeskillId, value }) => ({ tradeskillId, value }));
}

export function equipmentItemInfusionSkillStatBonuses(
  infusedItemIds: (ItemId | null)[],
): SkillStatBonus[] {
  return equipmentItemInfusionListBonuses(
    infusedItemIds,
    (content) => content.infusionSkillStatBonuses,
  );
}

// Merged per skill family and stat.
export function equipmentItemSkillStatBonuses(
  content: EquipmentContent,
  item?: EquipmentItem,
): SkillStatBonus[] {
  const infusionBonuses = item
    ? equipmentItemInfusionSkillStatBonuses(item.infusedItemIds)
    : [];
  const affixBonuses = item
    ? affixEffectsOfKind(equipmentItemAffixEffects(item), 'SkillStatBonus')
    : [];

  return mergeBonusesByKey(
    [...(content.skillStatBonuses ?? []), ...infusionBonuses, ...affixBonuses],
    (bonus) => `${bonus.skillFamily}|${bonus.stat}`,
  ).map(({ skillFamily, stat, value }) => ({ skillFamily, stat, value }));
}

// Weights a (possibly partial) dimension block by a same-keyed multiplier table, e.g. VALUE_MULTIPLIER_PER_STAT - used by both infusion cost and armory sell value.
export function weightedBlockTotal<K extends string>(
  block: Partial<Record<K, number>> | undefined,
  multiplierPerKey: Record<K, number>,
): number {
  return sumBy(
    Object.keys(multiplierPerKey) as K[],
    (key) => (block?.[key] ?? 0) * multiplierPerKey[key],
  );
}

// Infusion + affix only, no base equipment content - the "green bonus rows" UI shows under an item's base stats.
export function equipmentItemBonusTotals<K extends string>(
  item: EquipmentItem,
  dimension: EquipmentBonusDimension<K>,
): Record<K, number> {
  const infusion = equipmentItemInfusionTotals(item.infusedItemIds, dimension);
  const affixEffects = equipmentItemAffixEffects(item);
  const combined = dimension.defaultBlock();

  (Object.keys(combined) as K[]).forEach((key) => {
    combined[key] = infusion[key] + dimension.affixBonusFor(affixEffects, key);
  });

  return combined;
}
