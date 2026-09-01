import { getEntry } from '@helpers/content';
import {
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import { affixEffectSum, equipmentItemAffixEffects } from '@helpers/item/affix';
import { getGoldQuantity, getMaterialQuantity } from '@helpers/item/materials';
import type {
  CombatantCombatStats,
  EquipmentContent,
  EquipmentItem,
  ItemContent,
  ItemId,
  StatBlock,
  StatusEffectTag,
} from '@interfaces';
import { sum } from 'es-toolkit/compat';

const GOLD_PER_STAT_POINT = 30;
const GOLD_PER_RESISTANCE_POINT = 100;
const GOLD_PER_COMBAT_STAT_POINT = 50;

// Sums the `infusionStats` of every non-empty slot
export function equipmentItemInfusionBonus(
  infusedItemIds: (ItemId | null)[],
): StatBlock {
  const bonus = defaultStats();

  infusedItemIds.forEach((itemId) => {
    if (!itemId) return;

    const stats = getEntry<ItemContent>(itemId)?.infusionStats;
    if (!stats) return;

    (Object.keys(bonus) as Array<keyof StatBlock>).forEach((stat) => {
      bonus[stat] += stats[stat];
    });
  });

  return bonus;
}

// Sibling of `equipmentItemInfusionBonus` for per-tag debuff resistance.
export function equipmentItemInfusionResistanceBonus(
  infusedItemIds: (ItemId | null)[],
): Record<StatusEffectTag, number> {
  const bonus = defaultTagResistances();

  infusedItemIds.forEach((itemId) => {
    if (!itemId) return;

    const resistances =
      getEntry<ItemContent>(itemId)?.infusionDebuffResistances;
    if (!resistances) return;

    (Object.keys(bonus) as StatusEffectTag[]).forEach((tag) => {
      bonus[tag] += resistances[tag];
    });
  });

  return bonus;
}

// Sibling of `equipmentItemInfusionBonus` for combat stats.
export function equipmentItemInfusionCombatStatBonus(
  infusedItemIds: (ItemId | null)[],
): CombatantCombatStats {
  const bonus = defaultCombatStats();

  infusedItemIds.forEach((itemId) => {
    if (!itemId) return;

    const stats = getEntry<ItemContent>(itemId)?.infusionCombatStats;
    if (!stats) return;

    (Object.keys(bonus) as Array<keyof CombatantCombatStats>).forEach(
      (stat) => {
        bonus[stat] += stats[stat];
      },
    );
  });

  return bonus;
}

export function equipmentItemSlotCount(item: EquipmentItem): number {
  const baseSlots = getEntry<EquipmentContent>(item.equipmentId)?.slots ?? 0;
  const affixBonus = affixEffectSum(
    equipmentItemAffixEffects(item),
    'InfusionSlot',
  );

  return baseSlots + affixBonus;
}

export function isInfusionMaterial(item: ItemContent): boolean {
  const hasStatBonus =
    !!item.infusionStats &&
    Object.values(item.infusionStats).some((value) => value !== 0);
  const hasResistanceBonus =
    !!item.infusionDebuffResistances &&
    Object.values(item.infusionDebuffResistances).some((value) => value !== 0);
  const hasCombatStatBonus =
    !!item.infusionCombatStats &&
    Object.values(item.infusionCombatStats).some((value) => value !== 0);

  return hasStatBonus || hasResistanceBonus || hasCombatStatBonus;
}

// ~30g per total stat point, ~100g per total resistance point, ~50g per
// total combat stat point (a resistance percent is worth more than a raw
// stat point since it's a rarer, more specialized bonus - +1 stat -> 30g,
// +1% resistance -> 100g, +1 combat stat -> 50g).
export function infusionMaterialCost(itemId: ItemId): number {
  const content = getEntry<ItemContent>(itemId);
  const stats = content?.infusionStats;
  const resistances = content?.infusionDebuffResistances;
  const combatStats = content?.infusionCombatStats;
  if (!stats && !resistances && !combatStats) return 0;

  const statCost = stats ? GOLD_PER_STAT_POINT * sum(Object.values(stats)) : 0;
  const resistanceCost = resistances
    ? GOLD_PER_RESISTANCE_POINT * sum(Object.values(resistances))
    : 0;
  const combatStatCost = combatStats
    ? GOLD_PER_COMBAT_STAT_POINT * sum(Object.values(combatStats))
    : 0;

  return Math.round(statCost + resistanceCost + combatStatCost);
}

// Any slot (empty or already-infused) is a valid target - overwriting an
// infused slot is allowed, it just replaces the bonus with no refund.
export function canInfuseEquipmentItem(
  item: EquipmentItem,
  slotIndex: number,
  materialItemId: ItemId,
): boolean {
  const slotCount = equipmentItemSlotCount(item);
  if (slotIndex < 0 || slotIndex >= slotCount) return false;

  const material = getEntry<ItemContent>(materialItemId);
  if (!material || !isInfusionMaterial(material)) return false;

  if (getMaterialQuantity(materialItemId) < 1) return false;

  return getGoldQuantity() >= infusionMaterialCost(materialItemId);
}
