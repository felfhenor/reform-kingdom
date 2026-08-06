import type { HasAnimation } from '@interfaces/artable';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type JobId = Branded<string, 'JobId'>;

export type JobContent = IsContentItem &
  HasDescription &
  HasAnimation & {
    id: JobId;

    baseStats: StatBlock;
    statsPerLevel: StatBlock;

    equippableTypes: EquipmentItemType[];
  };
