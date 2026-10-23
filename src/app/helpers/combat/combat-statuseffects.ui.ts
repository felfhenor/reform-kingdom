import { statusEffectDamage } from '@helpers/combat/combat-statuseffects';
import type {
  Combatant,
  GameStat,
  StatusEffect,
  StatusEffectAddCombatStatNumber,
  StatusEffectBehavior,
  StatusEffectBehaviorAddStat,
  StatusEffectBehaviorTakeStat,
  StatusEffectBehaviorType,
  StatusEffectContent,
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
  amount: number | undefined,
  timing: StatusEffectPreviewTiming,
): StatusEffectPreviewModifier {
  const raises = behavior.type === 'AddDamageToStat';
  if (amount === undefined) {
    return {
      label: `${behavior.modifyStat} ${raises ? 'up' : 'down'}`,
      stat: behavior.modifyStat,
      isPercent: false,
      timing,
    };
  }

  return {
    label: behavior.modifyStat,
    stat: behavior.modifyStat,
    amount: raises ? amount : -amount,
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
    description: CombatStatDimension.info?.[behavior.combatStat],
  };
}

// A known amount means HP damage/healing is summarized separately; a one-off message has nothing to show.
function behaviorModifier(
  behavior: StatusEffectBehavior,
  amount: number | undefined,
  timing: StatusEffectPreviewTiming,
): StatusEffectPreviewModifier | undefined {
  switch (behavior.type) {
    case 'TakeDamage':
    case 'HealDamage':
      if (amount !== undefined) return undefined;
      return {
        label: behavior.type === 'TakeDamage' ? 'Takes damage' : 'Heals',
        isPercent: false,
        timing,
      };
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
  amount: number | undefined,
  timing: StatusEffectPreviewTiming,
): StatusEffectPreviewModifier[] {
  return behaviors
    .map((behavior) => behaviorModifier(behavior, amount, timing))
    .filter((modifier) => modifier !== undefined);
}

function statusEffectModifiers(
  effect: StatusEffectContent,
  amount?: number,
): StatusEffectPreviewModifier[] {
  return [
    ...behaviorModifiers(effect.onApply, amount, 'Active'),
    ...behaviorModifiers(effect.onTick, amount, 'PerTurn'),
  ];
}

function statusEffectPreviewBase(
  effect: StatusEffectContent,
): Pick<
  StatusEffectPreview,
  'id' | 'name' | 'sprite' | 'effectType' | 'elements' | 'tags' | 'trigger'
> {
  return {
    id: effect.id,
    name: effect.name,
    sprite: effect.sprite,
    effectType: effect.effectType,
    elements: effect.elements,
    tags: effect.tags,
    trigger: effect.trigger,
  };
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
    ...statusEffectPreviewBase(effect),
    turnsRemaining: effect.duration,
    damagePerTurn: amount * tickBehaviorCount(effect, 'TakeDamage'),
    healingPerTurn: amount * tickBehaviorCount(effect, 'HealDamage'),
    modifiers: statusEffectModifiers(effect, amount),
  };
}

const SCALED_BEHAVIORS: StatusEffectBehaviorType[] = [
  'TakeDamage',
  'HealDamage',
  'AddDamageToStat',
  'TakeDamageFromStat',
];

function statusEffectUsesScaling(effect: StatusEffectContent): boolean {
  return [...effect.onApply, ...effect.onTick].some((behavior) =>
    SCALED_BEHAVIORS.includes(behavior.type),
  );
}

function statusEffectScalingText(
  effect: StatusEffectContent,
  format: (value: number) => string,
): string | undefined {
  if (!statusEffectUsesScaling(effect)) return undefined;

  const whose = effect.useTargetStats ? "the target's" : "the caster's";
  const parts = (Object.keys(effect.statScaling) as GameStat[])
    .filter((stat) => effect.statScaling[stat] > 0)
    .map(
      (stat) =>
        `${format(effect.statScaling[stat] * 100)}% of ${whose} ${stat}`,
    );
  return parts.length > 0 ? `Based on ${parts.join(' + ')}` : undefined;
}

// Outside combat amounts can't be sized yet, so each change shows what it scales with instead.
export function statusEffectContentPreview(
  effect: StatusEffectContent,
  format: (value: number) => string,
): StatusEffectPreview {
  return {
    ...statusEffectPreviewBase(effect),
    damagePerTurn: 0,
    healingPerTurn: 0,
    modifiers: statusEffectModifiers(effect),
    scaling: statusEffectScalingText(effect, format),
  };
}

// Dead combatants skip their turns, so their effects never tick again.
export function combatantStatusEffectPreviews(
  combatant: Combatant,
): StatusEffectPreview[] {
  if (combatant.hp <= 0) return [];
  return combatant.statusEffects.map(statusEffectPreview);
}
