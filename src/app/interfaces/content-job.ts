import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';
import type { HasAnimation } from '@interfaces/artable';

export type JobId = Branded<string, 'JobId'>;

export type JobContent = IsContentItem &
  HasDescription &
  HasAnimation & {
    id: JobId;

    baseStats: StatBlock;
    statsPerLevel: StatBlock;
  };
