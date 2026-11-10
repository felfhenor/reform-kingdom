import type { HasSprite } from '@interfaces/artable';
import type { CombatStat } from '@interfaces/combat';
import type { StatusEffectTag } from '@interfaces/content-statuseffect';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GameStat } from '@interfaces/stat';
import type { WorldNodeType } from '@interfaces/tiled-map';

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

// `value` (a flat percent) is the chance of a gather cycle granting the GlobalGatheringItemDropAmountBoost extra items.
export type GlobalEffectEffectGatheringItemDropRateBoost = {
  effectType: 'GlobalGatheringItemDropRateBoost';
  value: number;
};

// Adds `value` (a flat count) to the extra items granted when the GlobalGatheringItemDropRateBoost roll succeeds.
export type GlobalEffectEffectGatheringItemDropAmountBoost = {
  effectType: 'GlobalGatheringItemDropAmountBoost';
  value: number;
};

// Adds `value` (a flat count) to every gather cycle, no roll needed.
export type GlobalEffectEffectGatheringItemFlatBoost = {
  effectType: 'GlobalGatheringItemFlatBoost';
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

// Whole percent on kingdom workers' gather speed, stacking additively.
export type GlobalEffectEffectWorkerGainXPMultiplierBonus = {
  effectType: 'WorkerXPGainMultiplier';
  value: number;
};

// Town shops stop stocking equipment, and towns stop crafting it.
export type GlobalEffectEffectTownShopNoEquipment = {
  effectType: 'GlobalTownShopNoEquipment';
};

// Level-gated UI shows from the start instead of waiting on party level.
export type GlobalEffectEffectFeaturesRevealed = {
  effectType: 'GlobalFeaturesRevealed';
};

// Combat-dropped gear rolls one curse affix on top of its normal affixes.
export type GlobalEffectEffectCursedDrops = {
  effectType: 'GlobalCursedDrops';
};

// Combat-dropped gear rolls `value` more normal affixes than its rarity gives.
export type GlobalEffectEffectDropExtraAffixes = {
  effectType: 'GlobalDropExtraAffixes';
  value: number;
};

// Kingdom-crafted gear rolls `value` more normal affixes than its rarity gives.
export type GlobalEffectEffectCraftedExtraAffixes = {
  effectType: 'GlobalCraftedExtraAffixes';
  value: number;
};

// Heroes earn `value` extra skill points (floored) per job level past 1; nodes over budget are pruned on load, so keep sources permanent.
export type GlobalEffectEffectSkillPointsPerLevel = {
  effectType: 'GlobalSkillPointsPerLevel';
  value: number;
};

// Heroes can't change class.
export type GlobalEffectEffectReclassDisabled = {
  effectType: 'GlobalReclassDisabled';
};

// Heroes act only on the player's round orders, except in Decree fights on sealed maps.
export type GlobalEffectEffectManualCombat = {
  effectType: 'GlobalManualCombat';
};

// The Decree can't target nodes on a map until its region is sealed.
export type GlobalEffectEffectRequireSealForDecreeAutomation = {
  effectType: 'GlobalRequireSealForDecreeAutomation';
};

// Every hero must have the same job; reclassing moves the whole party at once.
export type GlobalEffectEffectPartySharesClass = {
  effectType: 'GlobalPartySharesClass';
};

// Party job abilities that normally keep only the best hero's value add up instead.
export type GlobalEffectEffectJobAbilitiesStack = {
  effectType: 'GlobalJobAbilitiesStack';
};

// Every node of `nodeType` is removed from the map for the run, and remembrance stops counting what only it gives.
export type GlobalEffectEffectWorldNodeTypeRemoved = {
  effectType: 'GlobalWorldNodeTypeRemoved';
  nodeType: WorldNodeType;
};

// Every developable node of `nodeType` begins the run at this level (capped at its max), stacking additively.
export type GlobalEffectEffectWorldNodeStartingLevel = {
  effectType: 'GlobalWorldNodeStartingLevel';
  nodeType: WorldNodeType;
  value: number;
};

// Fraction (1 = double) on the reputation town commissions grant, stacking additively.
export type GlobalEffectEffectCommissionReputationBoost = {
  effectType: 'GlobalCommissionReputationBoost';
  value: number;
};

// Whole extra commission slots in every town.
export type GlobalEffectEffectTownCommissionSlotBoost = {
  effectType: 'GlobalTownCommissionSlotBoost';
  value: number;
};

// Fraction (1 = twice as long) on shrine buff duration, stacking additively.
export type GlobalEffectEffectShrineBuffDuration = {
  effectType: 'GlobalShrineBuffDuration';
  value: number;
};

// Fraction (0.5 = 50% stronger) on every value of a shrine buff, fixed when prayed.
export type GlobalEffectEffectShrineBuffStrength = {
  effectType: 'GlobalShrineBuffStrength';
  value: number;
};

// Fraction (1 = twice as long) on astral spell duration, stacking additively.
export type GlobalEffectEffectAstralSpellDuration = {
  effectType: 'GlobalAstralSpellDuration';
  value: number;
};

// Fraction (1 = twice as strong) on every value of an astral spell, fixed when cast.
export type GlobalEffectEffectAstralSpellStrength = {
  effectType: 'GlobalAstralSpellStrength';
  value: number;
};

// Whole percent per monster killed, split by weight into independent drops from its map's max-development gathering tables.
export type GlobalEffectEffectMonstersDropRegionGathering = {
  effectType: 'GlobalMonstersDropRegionGathering';
  value: number;
};

// Every material a kingdom recipe needs changes by `value` (whole units), never below 1.
export type GlobalEffectEffectRecipeMaterialBoost = {
  effectType: 'GlobalRecipeMaterialBoost';
  value: number;
};

// Fraction (-0.5 = half as long) on every craft's time - kingdom, workers and towns - stacking additively.
export type GlobalEffectEffectCraftTimeMultiplier = {
  effectType: 'GlobalCraftTimeMultiplier';
  value: number;
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
  | GlobalEffectEffectWorkerGainXPMultiplierBonus
  | GlobalEffectEffectTownShopNoEquipment
  | GlobalEffectEffectFeaturesRevealed
  | GlobalEffectEffectCursedDrops
  | GlobalEffectEffectDropExtraAffixes
  | GlobalEffectEffectCraftedExtraAffixes
  | GlobalEffectEffectRecipeMaterialBoost
  | GlobalEffectEffectCraftTimeMultiplier
  | GlobalEffectEffectSkillPointsPerLevel
  | GlobalEffectEffectReclassDisabled
  | GlobalEffectEffectManualCombat
  | GlobalEffectEffectRequireSealForDecreeAutomation
  | GlobalEffectEffectPartySharesClass
  | GlobalEffectEffectJobAbilitiesStack
  | GlobalEffectEffectWorldNodeTypeRemoved
  | GlobalEffectEffectWorldNodeStartingLevel
  | GlobalEffectEffectCommissionReputationBoost
  | GlobalEffectEffectTownCommissionSlotBoost
  | GlobalEffectEffectShrineBuffDuration
  | GlobalEffectEffectShrineBuffStrength
  | GlobalEffectEffectAstralSpellDuration
  | GlobalEffectEffectAstralSpellStrength
  | GlobalEffectEffectMonstersDropRegionGathering
  | GlobalEffectEffectDebuffResistance
  | GlobalEffectEffectDebuffResistanceTag
  | GlobalEffectEffectCombatItemDropRateBoost
  | GlobalEffectEffectGatheringItemDropRateBoost
  | GlobalEffectEffectGatheringItemDropAmountBoost
  | GlobalEffectEffectGatheringItemFlatBoost
  | GlobalEffectEffectArmorySizeBoost
  | GlobalEffectEffectTradeskillQueueSizeBoost
  | GlobalEffectEffectOffPathTravelSpeedBoost
  | GlobalEffectEffectOnPathTravelSpeedBoost
  | GlobalEffectEffectDecreeClauseCapBoost;

export type GlobalEffectContent = IsContentItem &
  HasSprite & {
    id: GlobalEffectId;
    // Left out, the text is generated from `effects`, so scaled values stay accurate.
    description?: string;
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
