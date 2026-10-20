import { getEntriesByType, getEntry } from '@helpers/content/content';
import { characterNonGearEffects } from '@helpers/hero/hero-effect';
import {
  skillModifiersForFamily,
  skillTreeNodeModifiers,
  skillWithModifiers,
} from '@helpers/hero/skill-modifier';
import { characterSkillTreeNodeIds } from '@helpers/hero/skill-tree';
import type {
  Character,
  EquipmentSkill,
  EquipmentSkillContent,
  HeroEffectSkillModifier,
  HeroEffectSkillModifierInflict,
  HeroEffectSkillModifierPotency,
  SkillModifierLine,
  SkillTreeNodeContent,
  SkillTreeNodeId,
  StatusEffectContent,
} from '@interfaces';

function turnsText(
  duration: number,
  format: (value: number) => string,
): string {
  return `${format(duration)} turn${duration === 1 ? '' : 's'}`;
}

function statusName(modifier: { statusEffectId: string }): string {
  return (
    getEntry<StatusEffectContent>(modifier.statusEffectId)?.name ??
    modifier.statusEffectId
  );
}

function inflictText(
  modifier: HeroEffectSkillModifierInflict,
  format: (value: number) => string,
): string {
  const hits = modifier.onElement ? ` on ${modifier.onElement} hits` : '';
  return `${format(modifier.chance)}% chance to inflict ${statusName(modifier)} for ${turnsText(modifier.duration, format)}${hits}`;
}

function potencyText(
  modifier: HeroEffectSkillModifierPotency,
  format: (value: number) => string,
): string {
  const parts = [
    modifier.chance ? `+${format(modifier.chance)}% chance` : '',
    modifier.duration ? `+${turnsText(modifier.duration, format)}` : '',
  ].filter((part) => part !== '');
  return `${statusName(modifier)}: ${parts.join(', ')}`;
}

export function skillModifierText(
  modifier: HeroEffectSkillModifier,
  format: (value: number) => string,
): string {
  switch (modifier.modifier) {
    case 'Targets':
      return `+${format(modifier.value)} target${modifier.value === 1 ? '' : 's'}`;
    case 'Element':
      return `+ ${modifier.element} element`;
    case 'Inflict':
      return inflictText(modifier, format);
    case 'Potency':
      return potencyText(modifier, format);
    case 'Scaling':
      return `+${format(modifier.value)}x ${modifier.stat} scaling`;
    case 'Accuracy':
      return `+${format(modifier.value)}% accuracy`;
    case 'Echo':
      return `Also casts ${getEntry<EquipmentSkillContent>(modifier.skillId)?.name ?? 'UNKNOWN'}`;
  }
}

function skillModifierLinesBy(
  modifiers: HeroEffectSkillModifier[],
  labelOf: (modifier: HeroEffectSkillModifier) => string,
  format: (value: number) => string,
): SkillModifierLine[] {
  const lines = new Map<string, SkillModifierLine>();
  modifiers.forEach((modifier) => {
    const label = labelOf(modifier);
    const line = lines.get(label) ?? { label, elements: [], texts: [] };
    if (modifier.modifier === 'Element') line.elements.push(modifier.element);
    else line.texts.push(skillModifierText(modifier, format));
    lines.set(label, line);
  });
  return [...lines.values()];
}

// One line per oath option the skill carries, e.g. "Conflagration: +1 target".
export function skillModifierLines(
  skill: EquipmentSkill,
  format: (value: number) => string,
): SkillModifierLine[] {
  return skillModifierLinesBy(
    skill.modifiers ?? [],
    (modifier) => modifier.source ?? 'Oath',
    format,
  );
}

// What an oath option node changes, one line per skill family, e.g. "Fireball: +1 target".
export function skillTreeNodeModifierLines(
  node: SkillTreeNodeContent,
  format: (value: number) => string,
): SkillModifierLine[] {
  return skillModifierLinesBy(
    skillTreeNodeModifiers(node),
    (modifier) => modifier.family,
    format,
  );
}

// Any tier of the family stands in for its art.
export function skillModifierFamilySkill(
  family: string,
): EquipmentSkillContent | undefined {
  return getEntriesByType<EquipmentSkillContent>('skill').find(
    (skill) => skill.family === family,
  );
}

// The skill as the hero would cast it once their staged picks are confirmed.
export function characterSkillPreview(
  character: Character,
  skill: EquipmentSkillContent,
  staged: SkillTreeNodeId[],
): EquipmentSkill {
  const learned = characterSkillTreeNodeIds(character, character.jobId);
  const effects = characterNonGearEffects({
    ...character,
    skillTreeNodes: {
      ...character.skillTreeNodes,
      [character.jobId]: [...learned, ...staged],
    },
  });
  return skillWithModifiers(
    skill,
    skillModifiersForFamily(effects, skill.family),
  );
}
