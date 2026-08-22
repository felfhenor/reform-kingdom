import { getEntry } from '@helpers/content';
import { defaultStats, defaultTagResistances } from '@helpers/defaults';
import { getGoldQuantity, getMaterialQuantity } from '@helpers/materials';
import type {
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  ItemContent,
  ItemId,
  StatBlock,
  StatusEffectTag,
} from '@interfaces';
import { sum } from 'es-toolkit/compat';

const GOLD_PER_STAT_POINT = 30;
const GOLD_PER_RESISTANCE_POINT = 100;

// Sums the `infusionStats` of every non-empty slot into a single bonus
// block - infusions are tracked by itemId, so the bonus is always resolved
// live from current content, never baked into the equipment item itself.
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

    const resistances = getEntry<ItemContent>(itemId)?.infusionDebuffResistances;
    if (!resistances) return;

    (Object.keys(bonus) as StatusEffectTag[]).forEach((tag) => {
      bonus[tag] += resistances[tag];
    });
  });

  return bonus;
}

export function equipmentItemSlotCount(equipmentId: EquipmentId): number {
  return getEntry<EquipmentContent>(equipmentId)?.slots ?? 0;
}

export function isInfusionMaterial(item: ItemContent): boolean {
  const hasStatBonus = !!item.infusionStats &&
    Object.values(item.infusionStats).some((value) => value !== 0);
  const hasResistanceBonus = !!item.infusionDebuffResistances &&
    Object.values(item.infusionDebuffResistances).some((value) => value !== 0);

  return hasStatBonus || hasResistanceBonus;
}

// ~30g per total stat point, ~100g per total resistance point (a resistance
// percent is worth more than a raw stat point since it's a rarer, more
// specialized bonus - +1 stat -> 30g, +1% resistance -> 100g).
export function infusionMaterialCost(itemId: ItemId): number {
  const content = getEntry<ItemContent>(itemId);
  const stats = content?.infusionStats;
  const resistances = content?.infusionDebuffResistances;
  if (!stats && !resistances) return 0;

  const statCost = stats ? GOLD_PER_STAT_POINT * sum(Object.values(stats)) : 0;
  const resistanceCost = resistances
    ? GOLD_PER_RESISTANCE_POINT * sum(Object.values(resistances))
    : 0;

  return Math.round(statCost + resistanceCost);
}

// Any slot (empty or already-infused) is a valid target - overwriting an
// infused slot is allowed, it just replaces the bonus with no refund.
export function canInfuseEquipmentItem(
  item: EquipmentItem,
  slotIndex: number,
  materialItemId: ItemId,
): boolean {
  const slotCount = equipmentItemSlotCount(item.equipmentId);
  if (slotIndex < 0 || slotIndex >= slotCount) return false;

  const material = getEntry<ItemContent>(materialItemId);
  if (!material || !isInfusionMaterial(material)) return false;

  if (getMaterialQuantity(materialItemId) < 1) return false;

  return getGoldQuantity() >= infusionMaterialCost(materialItemId);
}
