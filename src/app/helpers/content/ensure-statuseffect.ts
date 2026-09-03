import {
  VALID_COMBAT_STATS,
  VALID_GAME_ELEMENTS,
  VALID_GAME_STATS,
  VALID_STATUS_EFFECT_TAGS,
} from '@helpers/content/ensure-helpers-constants';
import {
  ensureArray,
  ensureEnumArray,
  ensureEnumValue,
} from '@helpers/content/ensure-helpers-core';
import { ensureStats } from '@helpers/content/ensure-helpers-stats';
import type {
  CombatantStatusEffectData,
  StatusEffectBehavior,
  StatusEffectBehaviorType,
  StatusEffectContent,
  StatusEffectId,
} from '../../interfaces';

function ensureStatusEffectBehavior(
  behavior: Record<string, unknown> = {},
): StatusEffectBehavior {
  const type = behavior['type'] as StatusEffectBehaviorType;
  const combatMessage = behavior['combatMessage'] as string | undefined;

  switch (type) {
    case 'AddDamageToStat':
    case 'TakeDamageFromStat':
      return {
        type,
        combatMessage,
        modifyStat: ensureEnumValue(
          behavior['modifyStat'],
          VALID_GAME_STATS,
          'Strength',
        ),
      };

    case 'AddCombatStatNumber':
    case 'TakeCombatStatNumber':
      return {
        type,
        combatMessage,
        combatStat: ensureEnumValue(
          behavior['combatStat'],
          VALID_COMBAT_STATS,
          'repeatActionChance',
        ),
        value: (behavior['value'] as number) ?? 0,
      };

    case 'ModifyStatusEffectData':
      return {
        type,
        combatMessage,
        key: (behavior['key'] as keyof CombatantStatusEffectData) ?? 'isFrozen',
        value: (behavior['value'] as boolean) ?? false,
      };

    case 'HealDamage':
    case 'TakeDamage':
      return { type, combatMessage };

    default:
      return {
        type: 'SendMessage',
        combatMessage: combatMessage ?? 'UNKNOWN',
      };
  }
}

export function ensureStatusEffect(
  effect: Partial<StatusEffectContent>,
): Required<StatusEffectContent> {
  return {
    id: effect.id ?? ('UNKNOWN' as StatusEffectId),
    name: effect.name ?? 'UNKNOWN',
    __type: 'statuseffect',
    effectType: effect.effectType ?? 'Buff',
    elements: ensureEnumArray(effect.elements, VALID_GAME_ELEMENTS),
    tags: ensureEnumArray(effect.tags, VALID_STATUS_EFFECT_TAGS),
    trigger: effect.trigger ?? 'TurnStart',
    onApply: ensureArray(effect.onApply, ensureStatusEffectBehavior),
    onTick: ensureArray(effect.onTick, ensureStatusEffectBehavior),
    onUnapply: ensureArray(effect.onUnapply, ensureStatusEffectBehavior),
    statScaling: ensureStats(effect.statScaling),
    useTargetStats: effect.useTargetStats ?? false,
  };
}
