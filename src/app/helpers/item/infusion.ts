import {
  GOLD_PER_COMBAT_STAT_POINT,
  GOLD_PER_RESISTANCE_POINT,
  GOLD_PER_STAT_POINT,
  VALUE_MULTIPLIER_PER_COMBAT_STAT,
  VALUE_MULTIPLIER_PER_RESISTANCE,
  VALUE_MULTIPLIER_PER_STAT,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { affixEffectSum, equipmentItemAffixEffects } from '@helpers/item/affix';
import {
  COMBAT_STAT_BONUS,
  equipmentItemInfusionTotals,
  RESISTANCE_BONUS,
  STAT_BONUS,
  weightedBlockTotal,
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

export function equipmentItemInfusionBonus(
  infusedItemIds: (ItemId | null)[],
): StatBlock {
  return equipmentItemInfusionTotals(infusedItemIds, STAT_BONUS);
}

export function equipmentItemInfusionResistanceBonus(
  infusedItemIds: (ItemId | null)[],
): StatusEffectBlock {
  return equipmentItemInfusionTotals(infusedItemIds, RESISTANCE_BONUS);
}

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

// Each dimension's flat GOLD_PER_*_POINT rate is weighted per-key by the matching VALUE_MULTIPLIER_PER_* table (same tables armory sell value uses).
export function infusionMaterialCost(itemId: ItemId): number {
  const content = getEntry<ItemContent>(itemId);
  if (!content) return 0;

  const statCost =
    GOLD_PER_STAT_POINT *
    weightedBlockTotal(
      STAT_BONUS.infusionBlock(content),
      VALUE_MULTIPLIER_PER_STAT,
    );
  const resistanceCost =
    GOLD_PER_RESISTANCE_POINT *
    weightedBlockTotal(
      RESISTANCE_BONUS.infusionBlock(content),
      VALUE_MULTIPLIER_PER_RESISTANCE,
    );
  const combatStatCost =
    GOLD_PER_COMBAT_STAT_POINT *
    weightedBlockTotal(
      COMBAT_STAT_BONUS.infusionBlock(content),
      VALUE_MULTIPLIER_PER_COMBAT_STAT,
    );

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
