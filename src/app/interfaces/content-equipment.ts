import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type EquipmentId = Branded<string, 'EquipmentId'>;

export type EquipmentContent = IsContentItem &
  HasDescription & {
    id: EquipmentId;
    baseStats: StatBlock;
    statsPerLevel: StatBlock;
  };
