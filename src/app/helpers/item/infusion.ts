import { getEntry } from '@helpers/content';
import { affixEffectSum, equipmentItemAffixEffects } from '@helpers/item/affix';
import {
  COMBAT_STAT_BONUS,
  equipmentItemInfusionTotals,
  RESISTANCE_BONUS,
  STAT_BONUS,
} from '@helpers/item/equipment-bonus';
import { getGoldQuantity, getMaterialQuantity } from '@helpers/item/materials';
import type {
  CombatStatBlock,
  EquipmentContent,
  EquipmentItem,
  ItemContent,
  ItemId,
  StatBlock,
  StatusEffectBlock,
} from '@interfaces';
import { sum } from 'es-toolkit/compat';

const GOLD_PER_STAT_POINT = 30;
const GOLD_PER_RESISTANCE_POINT = 100;
const GOLD_PER_COMBAT_STAT_POINT = 50;

// Sums the `infusionStats` of every non-empty slot
export function equipmentItemInfusionBonus(
  infusedItemIds: (ItemId | null)[],
): StatBlock {
  return equipmentItemInfusionTotals(infusedItemIds, STAT_BONUS);
}

// Sibling of `equipmentItemInfusionBonus` for per-tag debuff resistance.
export function equipmentItemInfusionResistanceBonus(
  infusedItemIds: (ItemId | null)[],
): StatusEffectBlock {
  return equipmentItemInfusionTotals(infusedItemIds, RESISTANCE_BONUS);
}

// Sibling of `equipmentItemInfusionBonus` for combat stats.
export function equipmentItemInfusionCombatStatBonus(
  infusedItemIds: (ItemId | null)[],
): CombatStatBlock {
  return equipmentItemInfusionTotals(infusedItemIds, COMBAT_STAT_BONUS);
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
  const hasStatBonus = Object.values(STAT_BONUS.infusionBlock(item) ?? {}).some(
    (value) => value !== 0,
  );
  const hasResistanceBonus = Object.values(
    RESISTANCE_BONUS.infusionBlock(item) ?? {},
  ).some((value) => value !== 0);
  const hasCombatStatBonus = Object.values(
    COMBAT_STAT_BONUS.infusionBlock(item) ?? {},
  ).some((value) => value !== 0);

  return hasStatBonus || hasResistanceBonus || hasCombatStatBonus;
}

// ~30g per total stat point, ~100g per total resistance point, ~50g per
// total combat stat point (a resistance percent is worth more than a raw
// stat point since it's a rarer, more specialized bonus - +1 stat -> 30g,
// +1% resistance -> 100g, +1 combat stat -> 50g).
export function infusionMaterialCost(itemId: ItemId): number {
  const content = getEntry<ItemContent>(itemId);
  if (!content) return 0;

  const statCost =
    GOLD_PER_STAT_POINT *
    sum(Object.values(STAT_BONUS.infusionBlock(content) ?? {}));
  const resistanceCost =
    GOLD_PER_RESISTANCE_POINT *
    sum(Object.values(RESISTANCE_BONUS.infusionBlock(content) ?? {}));
  const combatStatCost =
    GOLD_PER_COMBAT_STAT_POINT *
    sum(Object.values(COMBAT_STAT_BONUS.infusionBlock(content) ?? {}));

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
