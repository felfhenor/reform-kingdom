import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type JobId = Branded<string, 'JobId'>;

export type JobContent = IsContentItem &
  HasDescription & {
    id: JobId;

    baseStats: StatBlock;
    statsPerLevel: StatBlock;
  };
