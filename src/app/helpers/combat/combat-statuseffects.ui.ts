import {
  CombatStatDimension,
  StatDimension,
} from '@helpers/hero/stat-dimension';
import { i18nLabels, t } from '@helpers/i18n/i18n';
import { contentName } from '@helpers/i18n/i18n-content';
import { statusEffectDamage } from '@helpers/combat/combat-statuseffects';
import type {
  Combatant,
  CombatantStatusEffectData,
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

const CombatantStatusEffectDataLabel: Record<
  keyof CombatantStatusEffectData,
  string
> = i18nLabels('statusEffect.dataLabel', ['isFrozen']);

function statModifier(
  behavior: StatusEffectBehaviorAddStat | StatusEffectBehaviorTakeStat,
  amount: number | undefined,
  timing: StatusEffectPreviewTiming,
): StatusEffectPreviewModifier {
  const raises = behavior.type === 'AddDamageToStat';
  if (amount === undefined) {
    return {
      label: t(
        raises ? 'combatStatuseffects.statUp' : 'combatStatuseffects.statDown',
        { stat: StatDimension.label[behavior.modifyStat] },
      ),
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
        label:
          behavior.type === 'TakeDamage'
            ? t('combatStatuseffects.takesDamage')
            : t('combatStatuseffects.heals'),
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
    name: contentName(effect),
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

  const key = effect.useTargetStats
    ? 'combatStatuseffects.percentOfTargetStat'
    : 'combatStatuseffects.percentOfCasterStat';
  const parts = (Object.keys(effect.statScaling) as GameStat[])
    .filter((stat) => effect.statScaling[stat] > 0)
    .map((stat) =>
      t(key, {
        percent: format(effect.statScaling[stat] * 100),
        stat: StatDimension.label[stat],
      }),
    );
  return parts.length > 0
    ? t('combatStatuseffects.basedOn', { parts: parts.join(' + ') })
    : undefined;
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
