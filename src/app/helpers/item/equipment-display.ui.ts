import { getEntry } from '@helpers/content/content';
import {
  equipmentItemBonusStats,
  equipmentItemGrantedSkillIds,
} from '@helpers/item/equipment-display';
import type {
  EquipmentContent,
  EquipmentItem,
  EquipmentSkillContent,
  StatBlock,
} from '@interfaces';

// Base + bonus combined - the comparison baseline for diffing a candidate item against what's equipped.
export function equipmentItemTotalStats(
  item: EquipmentItem,
  content: EquipmentContent,
): StatBlock {
  const bonus = equipmentItemBonusStats(item);
  const total = { ...content.baseStats };

  (Object.keys(total) as Array<keyof StatBlock>).forEach((stat) => {
    total[stat] += bonus[stat];
  });

  return total;
}

export function equipmentItemGrantedSkills(
  item: EquipmentItem,
  content: EquipmentContent,
): EquipmentSkillContent[] {
  return equipmentItemGrantedSkillIds(item, content)
    .map((skillId) => getEntry<EquipmentSkillContent>(skillId))
    .filter((skill): skill is EquipmentSkillContent => !!skill);
}
