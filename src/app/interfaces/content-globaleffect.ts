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

// Adds `value` (a flat percent) to every status effect tag's resistance,
// unlike gear which targets specific tags - see `applyActiveDebuffResistanceEffects`.
export type GlobalEffectEffectDebuffResistance = {
  effectType: 'DebuffResistance';
  value: number;
};

export type GlobalEffectEffect =
  | GlobalEffectEffectGainStats
  | GlobalEffectEffectXPGainMultiplier
  | GlobalEffectEffectDebuffResistance;

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
