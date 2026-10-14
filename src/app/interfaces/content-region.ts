import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type RegionId = Branded<string, 'RegionId'>;

// `description` is the intro blurb shown the first time the party arrives on `mapName`.
export type RegionContent = IsContentItem &
  HasDescription & {
    id: RegionId;
    __type: 'region';

    mapName: string;
  };
