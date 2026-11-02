import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GameStat } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type EdictId = Branded<string, 'EdictId'>;

export type EdictKind =
  'PartySize' | 'Challenge' | 'Variant' | 'Boon' | 'SeatBoon';

// Enemy rather than Monster: monsters fighting for the player (guardians, hero summons) are never touched.
export type EdictStatTarget = 'Hero' | 'Enemy';

// Without a stat it scales every stat; percents are whole numbers and stack additively.
export type EdictEffectStatPercent = {
  effectType: 'StatPercent';
  target: EdictStatTarget;
  percent: number;
  stat?: GameStat;
};

export type EdictEffect = EdictEffectStatPercent;

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

    effects?: EdictEffect[];
  };
