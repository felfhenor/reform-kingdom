import type { HasSprite } from '@interfaces/artable';
import type { CombatStat } from '@interfaces/combat';
import type { StatusEffectTag } from '@interfaces/content-statuseffect';
import type { TradeskillId } from '@interfaces/content-tradeskill';
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

// Shrine prayers last until the next prayer replaces them.
export type GlobalEffectEffectShrineBuffsPermanent = {
  effectType: 'GlobalShrineBuffsPermanent';
};

// Fraction (-1 = none) on every stat heroes gain per level, from job and skill tree alike, stacking additively.
export type GlobalEffectEffectLevelStatMultiplier = {
  effectType: 'GlobalLevelStatMultiplier';
  value: number;
};

// Fraction (-0.5 = half as long) on Deaths Door and Healing, stacking additively.
export type GlobalEffectEffectDeathPenaltyMultiplier = {
  effectType: 'GlobalDeathPenaltyMultiplier';
  value: number;
};

// Fraction (-0.25 = 25% cheaper) on what town shops charge, stacking additively.
export type GlobalEffectEffectShopPriceMultiplier = {
  effectType: 'GlobalShopPriceMultiplier';
  value: number;
};

// Fraction (-0.25 = 25% cheaper) on what caravans charge, stacking additively.
export type GlobalEffectEffectTraderPriceMultiplier = {
  effectType: 'GlobalTraderPriceMultiplier';
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

// Adds `value` (a flat count) to the Armory's item capacity.
export type GlobalEffectEffectArmorySizeBoost = {
  effectType: 'GlobalArmorySizeBoost';
  value: number;
};

// Adds `value` (a flat count) to one tradeskill's craft queue slot count.
export type GlobalEffectEffectTradeskillQueueSizeBoost = {
  effectType: 'GlobalTradeskillQueueSizeBoost';
  tradeskillId: TradeskillId;
  value: number;
};

// Adds `value` (a flat count) to the Decree's clause cap.
export type GlobalEffectEffectDecreeClauseCapBoost = {
  effectType: 'GlobalDecreeClauseCapBoost';
  value: number;
};

// Adds `value` (a flat percent) to travel speed while off the authored path,
// stacking additively across sources.
export type GlobalEffectEffectOffPathTravelSpeedBoost = {
  effectType: 'GlobalOffPathTravelSpeedBoost';
  value: number;
};

// Adds `value` (a flat percent) to travel speed while on the authored path,
// stacking additively across sources.
export type GlobalEffectEffectOnPathTravelSpeedBoost = {
  effectType: 'GlobalOnPathTravelSpeedBoost';
  value: number;
};

// Whole percents, stacking additively; without a stat it scales every stat.
export type GlobalEffectEffectGainStatPercent = {
  effectType: 'GainStatPercent';
  stat?: GameStat;
  value: number;
};

// As GainStatPercent, for monsters fighting the party; guardians and hero summons are never touched.
export type GlobalEffectEffectEnemyStatPercent = {
  effectType: 'EnemyStatPercent';
  stat?: GameStat;
  value: number;
};

// Each enemy rolls `value` extra skills from the current region's skillPool; guardians and summons never do.
export type GlobalEffectEffectEnemyExtraSkills = {
  effectType: 'EnemyExtraSkills';
  value: number;
};

// A party wipe ends the run instead of sending the party to Deaths Door.
export type GlobalEffectEffectWipeEndsRun = {
  effectType: 'GlobalWipeEndsRun';
};

// Whole percent on kingdom workers' craft speed, stacking additively.
export type GlobalEffectEffectWorkerCraftSpeedPercent = {
  effectType: 'WorkerCraftSpeedPercent';
  value: number;
};

// Whole percent on kingdom workers' gather speed, stacking additively.
export type GlobalEffectEffectWorkerGatherSpeedPercent = {
  effectType: 'WorkerGatherSpeedPercent';
  value: number;
};

// Town shops stop stocking equipment, and towns stop crafting it.
export type GlobalEffectEffectTownShopNoEquipment = {
  effectType: 'GlobalTownShopNoEquipment';
};

export type GlobalEffectEffect =
  | GlobalEffectEffectGainStats
  | GlobalEffectEffectGainStatPercent
  | GlobalEffectEffectEnemyStatPercent
  | GlobalEffectEffectGainCombatStat
  | GlobalEffectEffectXPGainMultiplier
  | GlobalEffectEffectGoldGainMultiplier
  | GlobalEffectEffectShopPriceMultiplier
  | GlobalEffectEffectTraderPriceMultiplier
  | GlobalEffectEffectDeathPenaltyMultiplier
  | GlobalEffectEffectLevelStatMultiplier
  | GlobalEffectEffectShrineBuffsPermanent
  | GlobalEffectEffectEnemyExtraSkills
  | GlobalEffectEffectWipeEndsRun
  | GlobalEffectEffectWorkerCraftSpeedPercent
  | GlobalEffectEffectWorkerGatherSpeedPercent
  | GlobalEffectEffectTownShopNoEquipment
  | GlobalEffectEffectDebuffResistance
  | GlobalEffectEffectDebuffResistanceTag
  | GlobalEffectEffectCombatItemDropRateBoost
  | GlobalEffectEffectGatheringItemDropRateBoost
  | GlobalEffectEffectArmorySizeBoost
  | GlobalEffectEffectTradeskillQueueSizeBoost
  | GlobalEffectEffectOffPathTravelSpeedBoost
  | GlobalEffectEffectOnPathTravelSpeedBoost
  | GlobalEffectEffectDecreeClauseCapBoost;

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
