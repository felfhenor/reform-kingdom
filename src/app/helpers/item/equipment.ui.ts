import { equipmentEntriesForSlot } from '@helpers/item/equipment';
import { armoryGet } from '@helpers/kingdom/armory';
import type { EquipmentArmoryEntry, EquipmentSlot } from '@interfaces';

// Returns one entry per owned instance (not deduped by content id), so distinct physical copies (e.g. differently-infused swords) stay pickable.
export function equipmentAvailableForSlot(
  slot: EquipmentSlot,
): EquipmentArmoryEntry[] {
  return equipmentEntriesForSlot(armoryGet(), slot);
}
