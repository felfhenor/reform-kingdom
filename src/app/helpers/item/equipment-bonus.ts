import { getEntry } from '@helpers/content/content';
import {
  defaultAffinities,
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
  EffectStatSummary,
  EquipmentBonusDimension,
  EquipmentContent,
  EquipmentItem,
  GameElement,
  GatherYieldBonus,
  HeroEffect,
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

export const ELEMENT_RESISTANCE_BONUS: EquipmentBonusDimension<GameElement> = {
  defaultBlock: defaultAffinities,
  equipmentBlock: (content) => content.elementalResistances,
  infusionBlock: (content) => content.infusionElementalResistances,
  affixBonusFor: (affixEffects, key) =>
    affixEffectSum(
      affixEffects,
      'ElementalResistance',
      (effect) => effect.element === key,
    ),
};

export const ELEMENT_BOON_BONUS: EquipmentBonusDimension<GameElement> = {
  defaultBlock: defaultAffinities,
  equipmentBlock: (content) => content.elementalBoons,
  infusionBlock: (content) => content.infusionElementalBoons,
  affixBonusFor: (affixEffects, key) =>
    affixEffectSum(
      affixEffects,
      'ElementalBoon',
      (effect) => effect.element === key,
    ),
};

// Every fixed-key dimension's infusion getter - GatherYield/SkillStatBonus are checked separately below since their keys are dynamic content.
const INFUSION_BLOCKS: ((
  content: ItemContent,
) => Partial<Record<string, number>> | undefined)[] = [
  STAT_BONUS.infusionBlock,
  RESISTANCE_BONUS.infusionBlock,
  COMBAT_STAT_BONUS.infusionBlock,
  MONSTER_TYPE_DAMAGE_BONUS.infusionBlock,
  ELEMENT_RESISTANCE_BONUS.infusionBlock,
  ELEMENT_BOON_BONUS.infusionBlock,
];

// Lives here rather than in infusion.ts so content-only callers (the analysis CLI) can use it without pulling in game state.
export function isInfusionMaterial(item: ItemContent): boolean {
  const hasDimensionBonus = INFUSION_BLOCKS.some((infusionBlock) =>
    Object.values(infusionBlock(item) ?? {}).some((value) => value !== 0),
  );
  const hasGatherYieldBonus = (item.infusionGatherYieldBonuses ?? []).some(
    (bonus) => bonus.value !== 0,
  );
  const hasSkillStatBonus = (item.infusionSkillStatBonuses ?? []).some(
    (bonus) => bonus.value !== 0,
  );

  return hasDimensionBonus || hasGatherYieldBonus || hasSkillStatBonus;
}

// Sums one dimension's infusion bonus across every non-empty slot.
export function equipmentItemInfusionTotals<K extends string>(
  infusedItemIds: (ItemId | null)[],
  dimension: EquipmentBonusDimension<K>,
): Record<K, number> {
  const bonus = dimension.defaultBlock();

  infusedItemIds.forEach((itemId) => {
    if (!itemId) return;

    const content = getEntry<ItemContent>(itemId);
    const block = content ? dimension.infusionBlock(content) : undefined;
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
    return (content ? listOf(content) : undefined) ?? [];
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

// Non-gear sources (e.g. trainer teachings) share affix effect shapes, so they fold onto a gear total through the same dimension.
export function affixEffectsAddToBlock<K extends string>(
  block: Record<K, number>,
  effects: HeroEffect[],
  dimension: EquipmentBonusDimension<K>,
): Record<K, number> {
  const combined = { ...block };

  (Object.keys(combined) as K[]).forEach((key) => {
    combined[key] += dimension.affixBonusFor(effects, key);
  });

  return combined;
}

export function affixEffectsBlock<K extends string>(
  effects: HeroEffect[],
  dimension: EquipmentBonusDimension<K>,
): Record<K, number> {
  return affixEffectsAddToBlock(dimension.defaultBlock(), effects, dimension);
}

export const STAT_SUMMARY_EFFECT_KINDS = new Set<HeroEffect['kind']>([
  'Stat',
  'CombatStat',
  'Resistance',
  'MonsterTypeDamage',
  'ElementalResistance',
  'ElementalBoon',
]);

export function affixEffectsStatSummary(
  effects: HeroEffect[],
): EffectStatSummary {
  return {
    stats: affixEffectsBlock(effects, STAT_BONUS),
    resistances: affixEffectsBlock(effects, RESISTANCE_BONUS),
    combatStats: affixEffectsBlock(effects, COMBAT_STAT_BONUS),
    monsterTypeDamage: affixEffectsBlock(effects, MONSTER_TYPE_DAMAGE_BONUS),
    elementalResistances: affixEffectsBlock(effects, ELEMENT_RESISTANCE_BONUS),
    elementalBoons: affixEffectsBlock(effects, ELEMENT_BOON_BONUS),
  };
}

export function affixEffectsHaveStatSummary(effects: HeroEffect[]): boolean {
  return effects.some(
    (effect) =>
      STAT_SUMMARY_EFFECT_KINDS.has(effect.kind) &&
      'value' in effect &&
      effect.value !== 0,
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
