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
  | 'Bow'
  | 'Cloth Armor'
  | 'Dagger'
  | 'Dirk'
  | 'Hat'
  | 'Mace'
  | 'Ring'
  | 'Shield'
  | 'Spear'
  | 'Staff'
  | 'Sword'
  | 'Trinket'
  | 'Whip';

export const EquipmentTypeToSlot: Record<EquipmentItemType, EquipmentSlot[]> = {
  Accessory: ['Accessory'],
  Arrow: ['Ammo'],
  Artifact: ['Artifact'],
  Bow: ['Weapon', 'Offhand'],
  'Cloth Armor': ['Armor'],
  Dagger: ['Weapon'],
  Dirk: ['Offhand'],
  Hat: ['Helmet'],
  Mace: ['Weapon'],
  Ring: ['Ring'],
  Shield: ['Offhand'],
  Staff: ['Weapon', 'Offhand'],
  Spear: ['Weapon', 'Offhand'],
  Sword: ['Weapon'],
  Trinket: ['Accessory'],
  Whip: ['Weapon'],
};

export type EquipmentItem = {
  equipmentId: EquipmentId;
};

export type EquipmentBlock = Record<EquipmentSlot, EquipmentItem | undefined>;
