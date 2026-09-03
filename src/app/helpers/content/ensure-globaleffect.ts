import { ensureArray } from '@helpers/content/ensure-helpers-core';
import type {
  CombatStat,
  GameStat,
  GlobalEffectContent,
  GlobalEffectEffect,
  GlobalEffectEffectDebuffResistance,
  GlobalEffectEffectDebuffResistanceTag,
  GlobalEffectEffectGainCombatStat,
  GlobalEffectEffectGainStats,
  GlobalEffectEffectXPGainMultiplier,
  GlobalEffectId,
  StatusEffectTag,
} from '../../interfaces';

function ensureGlobalEffectEffect(
  effect: Partial<GlobalEffectEffectGainStats> &
    Partial<GlobalEffectEffectGainCombatStat> &
    Partial<GlobalEffectEffectXPGainMultiplier> &
    Partial<GlobalEffectEffectDebuffResistance> &
    Partial<GlobalEffectEffectDebuffResistanceTag> = {},
): GlobalEffectEffect {
  if (effect.effectType === 'GlobalXPGainMultiplier') {
    return { effectType: 'GlobalXPGainMultiplier', value: effect.value ?? 0 };
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
  };
}
