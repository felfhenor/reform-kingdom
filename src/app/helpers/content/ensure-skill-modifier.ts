import {
  VALID_GAME_ELEMENTS,
  VALID_GAME_STATS,
  VALID_SKILL_ATTRIBUTES,
} from '@helpers/content/ensure-helpers-constants';
import { ensureEnumValue } from '@helpers/content/ensure-helpers-core';
import type {
  EquipmentSkillId,
  GameElement,
  HeroEffectSkillModifier,
  HeroEffectSkillModifierInflict,
  HeroEffectSkillModifierPotency,
  StatusEffectId,
} from '@interfaces';

function ensureElement(value: unknown): GameElement {
  return ensureEnumValue(value, VALID_GAME_ELEMENTS, 'Fire');
}

function ensureStatusModifier(
  effect: Record<string, unknown>,
  family: string,
): HeroEffectSkillModifierInflict | HeroEffectSkillModifierPotency {
  const status = {
    kind: 'SkillModifier' as const,
    family,
    statusEffectId: (effect['statusEffectId'] as StatusEffectId) ?? 'UNKNOWN',
    chance: (effect['chance'] as number) ?? 0,
    duration: (effect['duration'] as number) ?? 0,
  };
  if (effect['modifier'] === 'Potency') {
    return { ...status, modifier: 'Potency' };
  }

  return {
    ...status,
    modifier: 'Inflict',
    ...(effect['onElement']
      ? { onElement: ensureElement(effect['onElement']) }
      : {}),
  };
}

export function ensureSkillModifierEffect(
  effect: Record<string, unknown>,
): HeroEffectSkillModifier {
  const kind = 'SkillModifier';
  const family = (effect['family'] as string) ?? 'UNKNOWN';
  const value = (effect['value'] as number) ?? 0;

  switch (effect['modifier']) {
    case 'Inflict':
    case 'Potency':
      return ensureStatusModifier(effect, family);
    case 'Scaling': {
      const stat = ensureEnumValue(effect['stat'], VALID_GAME_STATS, 'Spirit');
      return { kind, family, modifier: 'Scaling', stat, value };
    }
    case 'Accuracy':
      return { kind, family, modifier: 'Accuracy', value };
    case 'EpCost':
      return { kind, family, modifier: 'EpCost', value };
    case 'Attribute': {
      const attribute = ensureEnumValue(
        effect['attribute'],
        VALID_SKILL_ATTRIBUTES,
        'NeverMisses',
      );
      return { kind, family, modifier: 'Attribute', attribute };
    }
    case 'Element': {
      const element = ensureElement(effect['element']);
      return { kind, family, modifier: 'Element', element };
    }
    case 'Echo': {
      const skillId = (effect['skillId'] as EquipmentSkillId) ?? 'UNKNOWN';
      return { kind, family, modifier: 'Echo', skillId };
    }
    default:
      return { kind, family, modifier: 'Targets', value };
  }
}
