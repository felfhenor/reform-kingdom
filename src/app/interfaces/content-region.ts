import type { EncounterId } from '@interfaces/content-encounter';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type RegionId = Branded<string, 'RegionId'>;

export type RegionSeal = {
  sealEncounterId: EncounterId;
  parTicks: number;
};

// `description` is the intro blurb shown the first time the party arrives on `mapName`.
export type RegionContent = IsContentItem &
  HasDescription & {
    id: RegionId;
    __type: 'region';

    mapName: string;

    // The first clear of this encounter seals the region; sealing within parTicks of the run's start scores speed points.
    seal: RegionSeal;
  };
