import type { EquipmentItemType } from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';

export function allEquipmentItemTypes(): EquipmentItemType[] {
  return Object.keys(EquipmentTypeToSlot) as EquipmentItemType[];
}
