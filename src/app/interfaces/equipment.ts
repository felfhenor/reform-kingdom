import type { EquipmentId } from '@interfaces/content-equipment';

export type EquipmentSlot =
  | 'Armor'
  | 'Helmet'
  | 'Weapon'
  | 'Offhand'
  | 'Ring'
  | 'Accessory'
  | 'Artifact'
  | 'Ammo';

export type EquipmentItem = {
  equipmentId: EquipmentId;
};

export type EquipmentBlock = Record<EquipmentSlot, EquipmentItem | undefined>;
