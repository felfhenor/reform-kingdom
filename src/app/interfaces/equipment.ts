import type { EquipmentId } from '@interfaces/content-equipment';


export type EquipmentSlot = 'Armor' | 'Helmet' | 'Weapon' | 'Offhand' | 'Ring' | 'Necklace' | 'Artifact' | 'Ammo';

export type EquipmentItem = {
  equipmentId: EquipmentId;
}

export type EquipmentBlock = Record<EquipmentSlot, EquipmentItem | undefined>;
