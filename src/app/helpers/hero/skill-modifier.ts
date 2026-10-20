import { getEntry } from '@helpers/content/content';
import { skillTechniqueWithStatBonuses } from '@helpers/hero/skill';
import type {
  EquipmentSkill,
  EquipmentSkillAttribute,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  HeroEffect,
  HeroEffectSkillModifier,
  HeroEffectSkillModifierInflict,
  HeroEffectSkillModifierPotency,
  SkillTreeNodeContent,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

export function skillModifiersForFamily(
  effects: HeroEffect[],
  family: string,
): HeroEffectSkillModifier[] {
  return effects.filter(
    (effect): effect is HeroEffectSkillModifier =>
      effect.kind === 'SkillModifier' && effect.family === family,
  );
}

function techniqueInflicted(
  technique: EquipmentSkillContentTechnique,
  modifier: HeroEffectSkillModifierInflict,
): EquipmentSkillContentTechnique {
  if (modifier.onElement && !technique.elements.includes(modifier.onElement)) {
    return technique;
  }

  const { statusEffectId, chance, duration } = modifier;
  return {
    ...technique,
    statusEffects: [
      ...technique.statusEffects,
      { statusEffectId, chance, duration },
    ],
  };
}

// A sure hit also can't be dodged: the target's Luck dodge is a separate roll from missing.
function techniqueWithAttribute(
  technique: EquipmentSkillContentTechnique,
  attribute: EquipmentSkillAttribute,
): EquipmentSkillContentTechnique {
  const attributes = uniq([...technique.attributes, attribute]);
  return {
    ...technique,
    attributes:
      attribute === 'NeverMisses'
        ? attributes.filter((entry) => entry !== 'AllowLuckDodge')
        : attributes,
  };
}

function techniqueWithModifier(
  skill: EquipmentSkillContent,
  technique: EquipmentSkillContentTechnique,
  modifier: HeroEffectSkillModifier,
): EquipmentSkillContentTechnique {
  switch (modifier.modifier) {
    case 'Targets':
      return technique.targetType === 'Self'
        ? technique
        : { ...technique, targets: technique.targets + modifier.value };
    case 'Element':
      return {
        ...technique,
        elements: uniq([...technique.elements, modifier.element]),
      };
    case 'Inflict':
      return techniqueInflicted(technique, modifier);
    case 'Attribute':
      return techniqueWithAttribute(technique, modifier.attribute);
    case 'Accuracy':
      return {
        ...technique,
        accuracy: Math.min(100, technique.accuracy + modifier.value),
      };
    case 'Scaling':
      return skillTechniqueWithStatBonuses(skill, technique, [
        {
          skillFamily: skill.family,
          stat: modifier.stat,
          value: modifier.value,
        },
      ]);
    default:
      return technique;
  }
}

// Potency rides the existing status chance/duration boosts that combat already reads.
function skillWithPotency(
  skill: EquipmentSkill,
  modifier: HeroEffectSkillModifierPotency,
): EquipmentSkill {
  const { statusEffectId, chance, duration } = modifier;
  const chanceBoost = skill.mods?.statusEffectChanceBoost ?? {};
  const durationBoost = skill.mods?.statusEffectDurationBoost ?? {};
  return {
    ...skill,
    mods: {
      ...skill.mods,
      statusEffectChanceBoost: {
        ...chanceBoost,
        [statusEffectId]: (chanceBoost[statusEffectId] ?? 0) + chance,
      },
      statusEffectDurationBoost: {
        ...durationBoost,
        [statusEffectId]: (durationBoost[statusEffectId] ?? 0) + duration,
      },
    },
  };
}

function echoedTechniques(
  modifier: HeroEffectSkillModifier,
): EquipmentSkillContentTechnique[] {
  if (modifier.modifier !== 'Echo') return [];
  const echoed = getEntry<EquipmentSkillContent>(modifier.skillId);
  return (echoed?.techniques ?? []).map((technique) => ({
    ...technique,
    echoOf: modifier.skillId,
  }));
}

export function skillTreeNodeModifiers(
  node: SkillTreeNodeContent,
): HeroEffectSkillModifier[] {
  return node.effects.filter(
    (effect): effect is HeroEffectSkillModifier =>
      effect.kind === 'SkillModifier',
  );
}

// A copy of the skill with its family's modifiers folded in; echoed hits come after its own.
export function skillWithModifiers(
  skill: EquipmentSkillContent,
  modifiers: HeroEffectSkillModifier[],
): EquipmentSkill {
  if (modifiers.length === 0) return skill;

  const techniques = skill.techniques.map((technique) =>
    modifiers.reduce(
      (current, modifier) => techniqueWithModifier(skill, current, modifier),
      technique,
    ),
  );
  const modified: EquipmentSkill = {
    ...skill,
    modifiers,
    techniques: [...techniques, ...modifiers.flatMap(echoedTechniques)],
  };

  return modifiers
    .filter(
      (modifier): modifier is HeroEffectSkillModifierPotency =>
        modifier.modifier === 'Potency',
    )
    .reduce(skillWithPotency, modified);
}

// Only a skill's own hits; echoed hits always pick their own targets.
export function skillOwnTechniques(
  skill: EquipmentSkillContent,
): EquipmentSkillContentTechnique[] {
  return skill.techniques.filter((technique) => !technique.echoOf);
}
