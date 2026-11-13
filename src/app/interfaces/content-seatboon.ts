import type { GlobalEffectEffect } from '@interfaces/content-globaleffect';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type SeatBoonId = Branded<string, 'SeatBoonId'>;

// Granted by a party-size edict for the run; no art of its own.
export type SeatBoonContent = IsContentItem &
  HasDescription & {
    id: SeatBoonId;
    __type: 'seatboon';

    effects: GlobalEffectEffect[];
  };
