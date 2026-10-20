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
  HeroEffectSkillModifierEcho,
  HeroEffectSkillModifierInflict,
  HeroEffectSkillModifierPotency,
  SkillModifierLine,
  SkillModifierLineSegment,
  SkillTreeNodeArt,
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

// A status or skill name with its icon, so the line reads "inflict [icon] Burning".
function namedSegment(
  name: string,
  art: SkillTreeNodeArt,
): SkillModifierLineSegment {
  return { text: name, art };
}

function statusSegment(
  modifier: { statusEffectId: string },
  suffix = '',
): SkillModifierLineSegment {
  const status = getEntry<StatusEffectContent>(modifier.statusEffectId);
  return status
    ? namedSegment(`${status.name}${suffix}`, {
        sprite: status.sprite,
        spritesheet: 'statuseffect',
      })
    : { text: `${modifier.statusEffectId}${suffix}` };
}

function inflictSegments(
  modifier: HeroEffectSkillModifierInflict,
  format: (value: number) => string,
): SkillModifierLineSegment[] {
  const hits = modifier.onElement ? ` on ${modifier.onElement} hits` : '';
  const isBuff =
    getEntry<StatusEffectContent>(modifier.statusEffectId)?.effectType ===
    'Buff';
  return [
    {
      text: `${format(modifier.chance)}% chance to ${isBuff ? 'grant' : 'inflict'}`,
    },
    statusSegment(modifier),
    { text: `for ${turnsText(modifier.duration, format)}${hits}` },
  ];
}

function potencySegments(
  modifier: HeroEffectSkillModifierPotency,
  format: (value: number) => string,
): SkillModifierLineSegment[] {
  const parts = [
    modifier.chance ? `+${format(modifier.chance)}% chance` : '',
    modifier.duration ? `+${turnsText(modifier.duration, format)}` : '',
  ].filter((part) => part !== '');
  return [statusSegment(modifier, ':'), { text: parts.join(', ') }];
}

function echoSegments(
  modifier: HeroEffectSkillModifierEcho,
): SkillModifierLineSegment[] {
  const skill = getEntry<EquipmentSkillContent>(modifier.skillId);
  return [
    { text: 'Also casts' },
    skill
      ? namedSegment(skill.name, { sprite: skill.sprite, spritesheet: 'skill' })
      : { text: 'UNKNOWN' },
  ];
}

function skillModifierText(
  modifier: HeroEffectSkillModifier,
  format: (value: number) => string,
): string {
  switch (modifier.modifier) {
    case 'Targets':
      return `+${format(modifier.value)} target${modifier.value === 1 ? '' : 's'}`;
    case 'Scaling':
      return `+${format(modifier.value)}x ${modifier.stat} scaling`;
    case 'Accuracy':
      return `+${format(modifier.value)}% accuracy`;
    case 'EpCost':
      return `-${format(modifier.value)}% EP cost`;
    case 'Attribute':
      return modifier.attribute.replace(/([a-z])([A-Z])/g, '$1 $2');
    default:
      return '';
  }
}

export function skillModifierSegments(
  modifier: HeroEffectSkillModifier,
  format: (value: number) => string,
): SkillModifierLineSegment[] {
  switch (modifier.modifier) {
    case 'Inflict':
      return inflictSegments(modifier, format);
    case 'Potency':
      return potencySegments(modifier, format);
    case 'Echo':
      return echoSegments(modifier);
    default:
      return [{ text: skillModifierText(modifier, format) }];
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
    const line = lines.get(label) ?? {
      label,
      elements: [],
      entries: [],
    };
    if (modifier.modifier === 'Element') line.elements.push(modifier.element);
    else
      line.entries.push({ segments: skillModifierSegments(modifier, format) });
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

// What an oath option node changes, one line per change; the panel already shows the skill, so no label.
export function skillTreeNodeModifierLines(
  node: SkillTreeNodeContent,
  format: (value: number) => string,
): SkillModifierLine[] {
  return skillTreeNodeModifiers(node).map((modifier) =>
    modifier.modifier === 'Element'
      ? { label: '', elements: [modifier.element], entries: [] }
      : {
          label: '',
          elements: [],
          entries: [{ segments: skillModifierSegments(modifier, format) }],
        },
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
