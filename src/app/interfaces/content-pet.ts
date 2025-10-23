import type { HasAnimation } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type PetId = Branded<string, 'PetId'>;

export type PetContent = IsContentItem &
  HasDescription &
  HasAnimation & {
    id: PetId;
    baseStats: StatBlock;
    statsPerLevel: StatBlock;

    itemIds: string[];
  };
