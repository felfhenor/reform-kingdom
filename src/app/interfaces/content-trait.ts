import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type TraitId = Branded<string, 'TraitId'>;

export type TraitContent = IsContentItem &
  HasDescription & {
    id: TraitId;

    baseStats: StatBlock;
  };
