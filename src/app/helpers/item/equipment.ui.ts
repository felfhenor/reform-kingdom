import {
  equipmentCombatStatTotals,
  equipmentEntriesForSlot,
} from '@helpers/item/equipment';
import { armoryGet } from '@helpers/kingdom/armory';
import type {
  Character,
  CombatStatBlock,
  EquipmentArmoryEntry,
  EquipmentSlot,
} from '@interfaces';

// Returns one entry per owned instance (not deduped by content id), so distinct physical copies (e.g. differently-infused swords) stay pickable.
export function equipmentAvailableForSlot(
  slot: EquipmentSlot,
): EquipmentArmoryEntry[] {
  return equipmentEntriesForSlot(armoryGet(), slot);
}

// Gear-only, not the in-combat value (which also factors in a default
// combat-stat baseline, meaningless outside a `Combatant`).
export function characterCombatStatTotals(
  character: Character,
): CombatStatBlock {
  return equipmentCombatStatTotals(character.equipment);
}
