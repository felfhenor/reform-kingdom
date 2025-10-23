import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type StageId = Branded<string, 'StageId'>;

export type StageContent = IsContentItem &
  HasDescription & {
    id: StageId;
  };
