import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GlobalEffectEffect } from '@interfaces/content-globaleffect';
import type { ItemQuantity } from '@interfaces/cost';
import type { HasDescription } from '@interfaces/traits';

export type EdictId = Branded<string, 'EdictId'>;

export type EdictKind =
  'PartySize' | 'Challenge' | 'Variant' | 'Boon' | 'SeatBoon';

export type EdictContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: EdictId;
    __type: 'edict';

    kind: EdictKind;

    // Summed across a run's edicts to set its score multiplier; negative for boons.
    fragments: number;

    // Edicts sharing a non-empty group can't be picked together.
    group?: string;

    effects?: GlobalEffectEffect[];

    // Added to the kingdom's stock once, when the run's world is created.
    startingItems?: ItemQuantity[];

    // Temporary: only edicts whose effects are built can be picked; drop once all of them are.
    enabled?: boolean;
  };
