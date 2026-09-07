import type { HasSprite } from '@interfaces/artable';
import type { CombatStat } from '@interfaces/combat';
import type { StatusEffectTag } from '@interfaces/content-statuseffect';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GameStat } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type GlobalEffectId = Branded<string, 'GlobalEffectId'>;

export type GlobalEffectEffectGainStats = {
  effectType: 'GainStats';
  stat: GameStat;
  value: number;
};

export type GlobalEffectEffectGainCombatStat = {
  effectType: 'GainCombatStat';
  combatStat: CombatStat;
  value: number;
};

export type GlobalEffectEffectXPGainMultiplier = {
  effectType: 'GlobalXPGainMultiplier';
  value: number;
};

// Adds `value` (a flat percent) to every status effect tag's resistance,
// unlike gear which targets specific tags.
export type GlobalEffectEffectDebuffResistance = {
  effectType: 'DebuffResistance';
  value: number;
};

// Same as GlobalEffectEffectDebuffResistance but targets one tag only.
export type GlobalEffectEffectDebuffResistanceTag = {
  effectType: 'DebuffResistanceTag';
  tag: StatusEffectTag;
  value: number;
};

export type GlobalEffectEffect =
  | GlobalEffectEffectGainStats
  | GlobalEffectEffectGainCombatStat
  | GlobalEffectEffectXPGainMultiplier
  | GlobalEffectEffectDebuffResistance
  | GlobalEffectEffectDebuffResistanceTag;

export type GlobalEffectContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: GlobalEffectId;
    __type: 'globaleffect';
    effects: GlobalEffectEffect[];
    hideDuration?: boolean;
  };

export type GlobalEffect = GlobalEffectContent & {
  startTick: number;
  expiresAtTick: number;

  extendedDescription?: string;
};
