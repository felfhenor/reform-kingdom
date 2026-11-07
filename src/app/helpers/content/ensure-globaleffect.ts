import { ensureArray } from '@helpers/content/ensure-helpers-core';
import type {
  CombatStat,
  GameStat,
  GlobalEffectContent,
  GlobalEffectEffect,
  GlobalEffectEffectArmorySizeBoost,
  GlobalEffectEffectCombatItemDropRateBoost,
  GlobalEffectEffectDebuffResistance,
  GlobalEffectEffectDebuffResistanceTag,
  GlobalEffectEffectDecreeClauseCapBoost,
  GlobalEffectEffectEnemyStatPercent,
  GlobalEffectEffectGainCombatStat,
  GlobalEffectEffectGainStatPercent,
  GlobalEffectEffectGainStats,
  GlobalEffectEffectGatheringItemDropRateBoost,
  GlobalEffectEffectGoldGainMultiplier,
  GlobalEffectEffectOffPathTravelSpeedBoost,
  GlobalEffectEffectOnPathTravelSpeedBoost,
  GlobalEffectEffectShopPriceMultiplier,
  GlobalEffectEffectDeathPenaltyMultiplier,
  GlobalEffectEffectLevelStatMultiplier,
  GlobalEffectEffectShrineBuffsPermanent,
  GlobalEffectEffectEnemyExtraSkills,
  GlobalEffectEffectDropExtraAffixes,
  GlobalEffectEffectCraftedExtraAffixes,
  GlobalEffectEffectRecipeMaterialBoost,
  GlobalEffectEffectCraftTimeMultiplier,
  GlobalEffectEffectSkillPointsPerLevel,
  GlobalEffectEffectWipeEndsRun,
  GlobalEffectEffectTradeskillQueueSizeBoost,
  GlobalEffectEffectXPGainMultiplier,
  GlobalEffectId,
  StatusEffectTag,
  TradeskillId,
  WorldNodeType,
  GlobalEffectEffectWorldNodeTypeRemoved,
} from '@interfaces';

export function ensureGlobalEffectEffect(
  effect: Partial<GlobalEffectEffectGainStats> &
    Partial<GlobalEffectEffectGainStatPercent> &
    Partial<GlobalEffectEffectEnemyStatPercent> &
    Partial<GlobalEffectEffectGainCombatStat> &
    Partial<GlobalEffectEffectXPGainMultiplier> &
    Partial<GlobalEffectEffectShopPriceMultiplier> &
    Partial<GlobalEffectEffectDeathPenaltyMultiplier> &
    Partial<GlobalEffectEffectLevelStatMultiplier> &
    Partial<GlobalEffectEffectShrineBuffsPermanent> &
    Partial<GlobalEffectEffectEnemyExtraSkills> &
    Partial<GlobalEffectEffectDropExtraAffixes> &
    Partial<GlobalEffectEffectCraftedExtraAffixes> &
    Partial<GlobalEffectEffectRecipeMaterialBoost> &
    Partial<GlobalEffectEffectCraftTimeMultiplier> &
    Partial<GlobalEffectEffectSkillPointsPerLevel> &
    Partial<GlobalEffectEffectWipeEndsRun> &
    Partial<GlobalEffectEffectGoldGainMultiplier> &
    Partial<GlobalEffectEffectDebuffResistance> &
    Partial<GlobalEffectEffectDebuffResistanceTag> &
    Partial<GlobalEffectEffectCombatItemDropRateBoost> &
    Partial<GlobalEffectEffectGatheringItemDropRateBoost> &
    Partial<GlobalEffectEffectArmorySizeBoost> &
    Partial<GlobalEffectEffectTradeskillQueueSizeBoost> &
    Partial<GlobalEffectEffectOffPathTravelSpeedBoost> &
    Partial<GlobalEffectEffectOnPathTravelSpeedBoost> &
    Partial<GlobalEffectEffectDecreeClauseCapBoost> &
    Partial<GlobalEffectEffectWorldNodeTypeRemoved> = {},
): GlobalEffectEffect {
  if (
    effect.effectType === 'GainStatPercent' ||
    effect.effectType === 'EnemyStatPercent'
  ) {
    return {
      effectType: effect.effectType,
      value: effect.value ?? 0,
      ...(effect.stat === undefined ? {} : { stat: effect.stat as GameStat }),
    };
  }

  if (effect.effectType === 'GlobalXPGainMultiplier') {
    return { effectType: 'GlobalXPGainMultiplier', value: effect.value ?? 0 };
  }

  if (effect.effectType === 'GlobalDecreeClauseCapBoost') {
    return {
      effectType: 'GlobalDecreeClauseCapBoost',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalArmorySizeBoost') {
    return { effectType: 'GlobalArmorySizeBoost', value: effect.value ?? 0 };
  }

  if (effect.effectType === 'GlobalOffPathTravelSpeedBoost') {
    return {
      effectType: 'GlobalOffPathTravelSpeedBoost',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalOnPathTravelSpeedBoost') {
    return {
      effectType: 'GlobalOnPathTravelSpeedBoost',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalTradeskillQueueSizeBoost') {
    return {
      effectType: 'GlobalTradeskillQueueSizeBoost',
      tradeskillId: (effect.tradeskillId ?? 'UNKNOWN') as TradeskillId,
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalGoldGainMultiplier') {
    return {
      effectType: 'GlobalGoldGainMultiplier',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalShopPriceMultiplier') {
    return {
      effectType: 'GlobalShopPriceMultiplier',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalTraderPriceMultiplier') {
    return {
      effectType: 'GlobalTraderPriceMultiplier',
      value: effect.value ?? 0,
    };
  }

  if (
    effect.effectType === 'WorkerCraftSpeedPercent' ||
    effect.effectType === 'WorkerGatherSpeedPercent'
  ) {
    return { effectType: effect.effectType, value: effect.value ?? 0 };
  }

  if (effect.effectType === 'GlobalCursedDrops') {
    return { effectType: 'GlobalCursedDrops' };
  }

  if (
    effect.effectType === 'GlobalReclassDisabled' ||
    effect.effectType === 'GlobalPartySharesClass' ||
    effect.effectType === 'GlobalJobAbilitiesStack'
  ) {
    return { effectType: effect.effectType };
  }

  if (effect.effectType === 'GlobalWorldNodeTypeRemoved') {
    return {
      effectType: 'GlobalWorldNodeTypeRemoved',
      nodeType: effect.nodeType ?? ('UNKNOWN' as WorldNodeType),
    };
  }

  if (effect.effectType === 'GlobalTownShopNoEquipment') {
    return { effectType: 'GlobalTownShopNoEquipment' };
  }

  if (effect.effectType === 'GlobalWipeEndsRun') {
    return { effectType: 'GlobalWipeEndsRun' };
  }

  if (
    effect.effectType === 'EnemyExtraSkills' ||
    effect.effectType === 'GlobalDropExtraAffixes' ||
    effect.effectType === 'GlobalCraftedExtraAffixes' ||
    effect.effectType === 'GlobalRecipeMaterialBoost' ||
    effect.effectType === 'GlobalSkillPointsPerLevel' ||
    effect.effectType === 'GlobalCommissionReputationBoost' ||
    effect.effectType === 'GlobalTownCommissionSlotBoost' ||
    effect.effectType === 'GlobalAstralSpellDuration' ||
    effect.effectType === 'GlobalAstralSpellStrength' ||
    effect.effectType === 'GlobalShrineBuffDuration' ||
    effect.effectType === 'GlobalShrineBuffStrength'
  ) {
    return { effectType: effect.effectType, value: effect.value ?? 0 };
  }

  if (effect.effectType === 'GlobalShrineBuffsPermanent') {
    return { effectType: 'GlobalShrineBuffsPermanent' };
  }

  if (effect.effectType === 'GlobalLevelStatMultiplier') {
    return {
      effectType: 'GlobalLevelStatMultiplier',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalDeathPenaltyMultiplier') {
    return {
      effectType: 'GlobalDeathPenaltyMultiplier',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalCraftTimeMultiplier') {
    return {
      effectType: 'GlobalCraftTimeMultiplier',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalCombatItemDropRateBoost') {
    return {
      effectType: 'GlobalCombatItemDropRateBoost',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GlobalGatheringItemDropRateBoost') {
    return {
      effectType: 'GlobalGatheringItemDropRateBoost',
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'DebuffResistance') {
    return { effectType: 'DebuffResistance', value: effect.value ?? 0 };
  }

  if (effect.effectType === 'DebuffResistanceTag') {
    return {
      effectType: 'DebuffResistanceTag',
      tag: (effect.tag ?? 'Stun') as StatusEffectTag,
      value: effect.value ?? 0,
    };
  }

  if (effect.effectType === 'GainCombatStat') {
    return {
      effectType: 'GainCombatStat',
      combatStat: (effect.combatStat ?? 'reviveChance') as CombatStat,
      value: effect.value ?? 0,
    };
  }

  return {
    effectType: 'GainStats',
    stat: (effect.stat ?? 'Strength') as GameStat,
    value: effect.value ?? 0,
  };
}

export function ensureGlobalEffect(
  effect: Partial<GlobalEffectContent>,
): Required<GlobalEffectContent> {
  return {
    id: effect.id ?? ('UNKNOWN' as GlobalEffectId),
    name: effect.name ?? 'UNKNOWN',
    __type: 'globaleffect',
    sprite: effect.sprite ?? 'UNKNOWN',
    description: effect.description ?? '',
    effects: ensureArray(effect.effects, ensureGlobalEffectEffect),
    hideDuration: effect.hideDuration ?? false,
    isShrineBuff: effect.isShrineBuff ?? false,
  };
}
