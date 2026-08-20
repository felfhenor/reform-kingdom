import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GameStat } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type GlobalEffectId = Branded<string, 'GlobalEffectId'>;

export type GlobalEffectEffectGainStats = {
  effectType: 'GainStats';
  stat: GameStat;
  value: number;
};

export type GlobalEffectEffectXPGainMultiplier = {
  effectType: 'GlobalXPGainMultiplier';
  value: number;
};

export type GlobalEffectEffect =
  | GlobalEffectEffectGainStats
  | GlobalEffectEffectXPGainMultiplier;

export type GlobalEffectContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: GlobalEffectId;
    __type: 'globaleffect';
    effects: GlobalEffectEffect[];
  };

export type GlobalEffect = GlobalEffectContent & {
  startTick: number;
  expiresAtTick: number;
};
