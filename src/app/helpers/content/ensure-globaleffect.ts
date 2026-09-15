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
  GlobalEffectEffectGainCombatStat,
  GlobalEffectEffectGainStats,
  GlobalEffectEffectGatheringItemDropRateBoost,
  GlobalEffectEffectGoldGainMultiplier,
  GlobalEffectEffectOffPathTravelSpeedBoost,
  GlobalEffectEffectTradeskillQueueSizeBoost,
  GlobalEffectEffectXPGainMultiplier,
  GlobalEffectId,
  StatusEffectTag,
  TradeskillId,
} from '@interfaces';

export function ensureGlobalEffectEffect(
  effect: Partial<GlobalEffectEffectGainStats> &
    Partial<GlobalEffectEffectGainCombatStat> &
    Partial<GlobalEffectEffectXPGainMultiplier> &
    Partial<GlobalEffectEffectGoldGainMultiplier> &
    Partial<GlobalEffectEffectDebuffResistance> &
    Partial<GlobalEffectEffectDebuffResistanceTag> &
    Partial<GlobalEffectEffectCombatItemDropRateBoost> &
    Partial<GlobalEffectEffectGatheringItemDropRateBoost> &
    Partial<GlobalEffectEffectArmorySizeBoost> &
    Partial<GlobalEffectEffectTradeskillQueueSizeBoost> &
    Partial<GlobalEffectEffectOffPathTravelSpeedBoost> = {},
): GlobalEffectEffect {
  if (effect.effectType === 'GlobalXPGainMultiplier') {
    return { effectType: 'GlobalXPGainMultiplier', value: effect.value ?? 0 };
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
    description: effect.description ?? 'UNKNOWN',
    effects: ensureArray(effect.effects, ensureGlobalEffectEffect),
    hideDuration: effect.hideDuration ?? false,
    isShrineBuff: effect.isShrineBuff ?? false,
  };
}
