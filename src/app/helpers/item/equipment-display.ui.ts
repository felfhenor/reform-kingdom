import { getEntry } from '@helpers/content/content';
import { equipmentItemGrantedSkillIds } from '@helpers/item/equipment-display';
import type {
  EquipmentContent,
  EquipmentItem,
  EquipmentSkillContent,
} from '@interfaces';

export function equipmentItemGrantedSkills(
  item: EquipmentItem,
  content: EquipmentContent,
): EquipmentSkillContent[] {
  return equipmentItemGrantedSkillIds(item, content)
    .map((skillId) => getEntry<EquipmentSkillContent>(skillId))
    .filter((skill): skill is EquipmentSkillContent => !!skill);
}
