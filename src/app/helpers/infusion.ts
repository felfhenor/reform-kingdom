import { getEntry } from '@helpers/content';
import { defaultStats } from '@helpers/defaults';
import { getGoldQuantity, getMaterialQuantity } from '@helpers/materials';
import type {
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  ItemContent,
  ItemId,
  StatBlock,
} from '@interfaces';
import { sum } from 'es-toolkit/compat';

const GOLD_PER_STAT_POINT = 30;

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

export function equipmentItemSlotCount(equipmentId: EquipmentId): number {
  return getEntry<EquipmentContent>(equipmentId)?.slots ?? 0;
}

export function isInfusionMaterial(item: ItemContent): boolean {
  if (!item.infusionStats) return false;
  return Object.values(item.infusionStats).some((value) => value !== 0);
}

// ~30g per total stat point granted (+1 total -> 30g, +10 total -> 300g).
export function infusionMaterialCost(itemId: ItemId): number {
  const stats = getEntry<ItemContent>(itemId)?.infusionStats;
  if (!stats) return 0;

  return Math.round(GOLD_PER_STAT_POINT * sum(Object.values(stats)));
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
