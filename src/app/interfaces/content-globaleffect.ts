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

export type GlobalEffectEffectGoldGainMultiplier = {
  effectType: 'GlobalGoldGainMultiplier';
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

// Adds `value` (a flat percent) to item drop chance rolls from combat sources only.
export type GlobalEffectEffectCombatItemDropRateBoost = {
  effectType: 'GlobalCombatItemDropRateBoost';
  value: number;
};

// `value` (a flat percent) is the chance of +1 extra item on a gather cycle
export type GlobalEffectEffectGatheringItemDropRateBoost = {
  effectType: 'GlobalGatheringItemDropRateBoost';
  value: number;
};

export type GlobalEffectEffect =
  | GlobalEffectEffectGainStats
  | GlobalEffectEffectGainCombatStat
  | GlobalEffectEffectXPGainMultiplier
  | GlobalEffectEffectGoldGainMultiplier
  | GlobalEffectEffectDebuffResistance
  | GlobalEffectEffectDebuffResistanceTag
  | GlobalEffectEffectCombatItemDropRateBoost
  | GlobalEffectEffectGatheringItemDropRateBoost;

export type GlobalEffectContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: GlobalEffectId;
    __type: 'globaleffect';
    effects: GlobalEffectEffect[];
    hideDuration?: boolean;

    // Flags a buff as shrine-granted, so praying at any shrine clears every other one.
    isShrineBuff?: boolean;
  };

export type GlobalEffect = GlobalEffectContent & {
  startTick: number;
  expiresAtTick: number;

  extendedDescription?: string;
};
