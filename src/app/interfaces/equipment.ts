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

export type EquipmentItemType =
  | 'Accessory'
  | 'Arrow'
  | 'Artifact'
  | 'Cloth Armor'
  | 'Dagger'
  | 'Dirk'
  | 'Hat'
  | 'Ring'
  | 'Shield'
  | 'Spear'
  | 'Sword'
  | 'Trinket';

export const EquipmentTypeToSlot: Record<EquipmentItemType, EquipmentSlot[]> = {
  Accessory: ['Accessory'],
  Arrow: ['Ammo'],
  Artifact: ['Artifact'],
  'Cloth Armor': ['Armor'],
  Dagger: ['Weapon'],
  Dirk: ['Offhand'],
  Hat: ['Helmet'],
  Ring: ['Ring'],
  Shield: ['Offhand'],
  Spear: ['Weapon', 'Offhand'],
  Sword: ['Weapon'],
  Trinket: ['Accessory'],
};

export type EquipmentItem = {
  equipmentId: EquipmentId;
};

export type EquipmentBlock = Record<EquipmentSlot, EquipmentItem | undefined>;
