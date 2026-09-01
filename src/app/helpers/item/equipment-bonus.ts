import { getEntry } from '@helpers/content';
import {
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import { affixEffectSum, equipmentItemAffixEffects } from '@helpers/item/affix';
import type {
  CombatantCombatStats,
  EquipmentBonusDimension,
  EquipmentItem,
  ItemContent,
  ItemId,
  StatBlock,
  StatusEffectTag,
} from '@interfaces';

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

export const COMBAT_STAT_BONUS: EquipmentBonusDimension<
  keyof CombatantCombatStats
> = {
  defaultBlock: defaultCombatStats,
  equipmentBlock: (content) => content.combatStats,
  infusionBlock: (content) => content.infusionCombatStats,
  affixBonusFor: (affixEffects, key) =>
    affixEffectSum(affixEffects, 'CombatStat', (effect) => effect.stat === key),
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
