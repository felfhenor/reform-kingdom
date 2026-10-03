import type { EquipmentContent } from '@interfaces/content-equipment';
import type { DropRarity } from '@interfaces/droppable';
import type { EquipmentItemType } from '@interfaces/equipment';

export type LootFilterSettings = {
  keepRarities: Record<DropRarity, boolean>;
  minimumItemLevel: number;
  keepEquipmentTypes: Record<EquipmentItemType, boolean>;
};

export type LootDropOutcome =
  | { kind: 'NoRoom' }
  | { kind: 'UnknownContent' }
  | { kind: 'Kept'; content: EquipmentContent }
  | { kind: 'AutoSold'; content: EquipmentContent; goldEarned: number };
