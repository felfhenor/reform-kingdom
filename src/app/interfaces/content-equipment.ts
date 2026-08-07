import type { HasSprite } from '@interfaces/artable';
import type { HasRarity } from '@interfaces/droppable';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type EquipmentId = Branded<string, 'EquipmentId'>;

export type EquipmentContent = IsContentItem &
  HasDescription &
  HasSprite &
  HasRarity & {
    id: EquipmentId;
    levelRequirement: number;
    baseStats: StatBlock;
    type: EquipmentItemType;
    slots: number;

    unobtainable?: boolean;
  };
