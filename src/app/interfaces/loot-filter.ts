import type {
  EquipmentContent,
  EquipmentId,
} from '@interfaces/content-equipment';
import type { DropRarity } from '@interfaces/droppable';
import type { EquipmentItemType } from '@interfaces/equipment';

export type LootSource = 'Combat' | 'Crafting';

export type LootFilterSettings = {
  sellFromSources: Record<LootSource, boolean>;
  keepRarities: Record<DropRarity, boolean>;
  minimumItemLevel: number;
  keepEquipmentTypes: Record<EquipmentItemType, boolean>;
  exceptEquipment: EquipmentId[];
};

export type LootDropOutcome =
  | { kind: 'NoRoom' }
  | { kind: 'UnknownContent' }
  | { kind: 'Kept'; content: EquipmentContent }
  | { kind: 'AutoSold'; content: EquipmentContent; goldEarned: number };
