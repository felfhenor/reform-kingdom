import type {
  EquipmentContent,
  EquipmentId,
} from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { Branded } from '@interfaces/identifiable';

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
  | 'Charm'
  | 'Cloth Armor'
  | 'Dagger'
  | 'Dirk'
  | 'Hat'
  | 'Mace'
  | 'Metal Armor'
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
  Charm: ['Offhand'],
  'Cloth Armor': ['Armor'],
  Dagger: ['Weapon'],
  Dirk: ['Offhand'],
  Hat: ['Helmet'],
  Mace: ['Weapon'],
  'Metal Armor': ['Armor'],
  Ring: ['Ring'],
  Shield: ['Offhand'],
  Staff: ['Weapon', 'Offhand'],
  Spear: ['Weapon', 'Offhand'],
  Sword: ['Weapon'],
  Trinket: ['Accessory'],
  Whip: ['Weapon'],
};

export type EquipmentItemId = Branded<string, 'EquipmentItemId'>;

export type EquipmentItem = {
  id: EquipmentItemId;
  equipmentId: EquipmentId;
  // Sparse, indexed by slot position - slot 2 stays slot 2 even if slot 1
  // is empty (`null`). Infusing a slot always overwrites whatever was
  // there; there is no way to empty a slot back out.
  infusedItemIds: (ItemId | null)[];
};

export type EquipmentBlock = Record<EquipmentSlot, EquipmentItem | undefined>;

// Pairs an owned instance with its resolved content, for per-instance list
// views (armory list, equip picker) where duplicate copies of the same
// content id must stay visually distinct (e.g. different infusions).
export type EquipmentArmoryEntry = {
  item: EquipmentItem;
  content: EquipmentContent;
};
