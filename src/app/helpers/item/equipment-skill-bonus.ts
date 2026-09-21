import { getEntry } from '@helpers/content/content';
import { equipmentItemSkillStatBonuses } from '@helpers/item/equipment-bonus';
import { equippedItems } from '@helpers/item/equipment';
import type {
  EquipmentBlock,
  EquipmentContent,
  SkillStatBonus,
} from '@interfaces';

// Base + infusion + affix skill stat bonuses across every equipped item; a two-hander counts once.
export function equipmentSkillStatBonuses(
  equipment: EquipmentBlock,
): SkillStatBonus[] {
  return equippedItems(equipment).flatMap((item) => {
    const content = getEntry<EquipmentContent>(item.equipmentId);
    return content ? equipmentItemSkillStatBonuses(content, item) : [];
  });
}
