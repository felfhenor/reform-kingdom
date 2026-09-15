import type { DropRarity } from '@interfaces/droppable';
import type { EquipmentItemType } from '@interfaces/equipment';

export type LootFilterSettings = {
  keepRarities: Record<DropRarity, boolean>;
  minimumItemLevel: number;
  keepEquipmentTypes: Record<EquipmentItemType, boolean>;
};
