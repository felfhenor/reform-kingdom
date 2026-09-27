import { statusEffectDamage } from '@helpers/combat/combat-statuseffects';
import type {
  Combatant,
  StatusEffect,
  StatusEffectAddCombatStatNumber,
  StatusEffectBehavior,
  StatusEffectBehaviorAddStat,
  StatusEffectBehaviorTakeStat,
  StatusEffectBehaviorType,
  StatusEffectPreview,
  StatusEffectPreviewModifier,
  StatusEffectPreviewTiming,
  StatusEffectTakeCombatStatNumber,
} from '@interfaces';
import {
  CombatantStatusEffectDataLabel,
  CombatStatDimension,
} from '@interfaces';

function statModifier(
  behavior: StatusEffectBehaviorAddStat | StatusEffectBehaviorTakeStat,
  amount: number,
  timing: StatusEffectPreviewTiming,
): StatusEffectPreviewModifier {
  const sign = behavior.type === 'AddDamageToStat' ? 1 : -1;
  return {
    label: behavior.modifyStat,
    stat: behavior.modifyStat,
    amount: sign * amount,
    isPercent: false,
    timing,
  };
}

function combatStatModifier(
  behavior: StatusEffectAddCombatStatNumber | StatusEffectTakeCombatStatNumber,
  timing: StatusEffectPreviewTiming,
): StatusEffectPreviewModifier {
  const sign = behavior.type === 'AddCombatStatNumber' ? 1 : -1;
  return {
    label: CombatStatDimension.label[behavior.combatStat],
    icon: CombatStatDimension.icon[behavior.combatStat],
    amount: sign * behavior.value,
    isPercent: CombatStatDimension.isPercent?.[behavior.combatStat] ?? true,
    timing,
  };
}

// HP damage/healing is summarized separately, and a one-off message has nothing to show.
function behaviorModifier(
  behavior: StatusEffectBehavior,
  amount: number,
  timing: StatusEffectPreviewTiming,
): StatusEffectPreviewModifier | undefined {
  switch (behavior.type) {
    case 'AddDamageToStat':
    case 'TakeDamageFromStat':
      return statModifier(behavior, amount, timing);
    case 'AddCombatStatNumber':
    case 'TakeCombatStatNumber':
      return combatStatModifier(behavior, timing);
    case 'ModifyStatusEffectData':
      if (!behavior.value) return undefined;
      return {
        label: CombatantStatusEffectDataLabel[behavior.key],
        isPercent: false,
        timing,
      };
    default:
      return undefined;
  }
}

function behaviorModifiers(
  behaviors: StatusEffectBehavior[],
  amount: number,
  timing: StatusEffectPreviewTiming,
): StatusEffectPreviewModifier[] {
  return behaviors
    .map((behavior) => behaviorModifier(behavior, amount, timing))
    .filter((modifier) => modifier !== undefined);
}

function tickBehaviorCount(
  effect: StatusEffect,
  type: StatusEffectBehaviorType,
): number {
  return effect.onTick.filter((behavior) => behavior.type === type).length;
}

export function statusEffectPreview(effect: StatusEffect): StatusEffectPreview {
  const amount = statusEffectDamage(effect);

  return {
    id: effect.id,
    name: effect.name,
    sprite: effect.sprite,
    effectType: effect.effectType,
    elements: effect.elements,
    tags: effect.tags,
    trigger: effect.trigger,
    turnsRemaining: effect.duration,
    damagePerTurn: amount * tickBehaviorCount(effect, 'TakeDamage'),
    healingPerTurn: amount * tickBehaviorCount(effect, 'HealDamage'),
    modifiers: [
      ...behaviorModifiers(effect.onApply, amount, 'Active'),
      ...behaviorModifiers(effect.onTick, amount, 'PerTurn'),
    ],
  };
}

// Dead combatants skip their turns, so their effects never tick again.
export function combatantStatusEffectPreviews(
  combatant: Combatant,
): StatusEffectPreview[] {
  if (combatant.hp <= 0) return [];
  return combatant.statusEffects.map(statusEffectPreview);
}
