import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GlobalEffectEffect } from '@interfaces/content-globaleffect';
import type { ItemQuantity } from '@interfaces/cost';
import type { SeatBoonId } from '@interfaces/content-seatboon';
import type { HasDescription } from '@interfaces/traits';

export type EdictId = Branded<string, 'EdictId'>;

export type EdictKind = 'PartySize' | 'Challenge' | 'Variant' | 'Boon';

export type EdictContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: EdictId;
    __type: 'edict';

    kind: EdictKind;

    // Summed across a run's edicts to set its score multiplier; negative for boons.
    fragments: number;

    // Edicts sharing any group can't be picked together.
    groups?: string[];

    effects?: GlobalEffectEffect[];

    // Added to the kingdom's stock once, when the run's world is created.
    startingItems?: ItemQuantity[];

    // Heroes the run starts with; the lowest picked wins.
    partySize?: number;

    seatBoonIds?: SeatBoonId[];
  };
