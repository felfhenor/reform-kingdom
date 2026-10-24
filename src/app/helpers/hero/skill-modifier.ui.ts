import { combatantFromCharacter } from '@helpers/combat/combat-create';
import { statusEffectContentPreview } from '@helpers/combat/combat-statuseffects.ui';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { ensureElementBlock } from '@helpers/content/ensure-helpers-stats';
import { characterNonGearEffects } from '@helpers/hero/hero-effect';
import {
  skillModifiersForFamily,
  skillTreeNodeModifiers,
  skillWithModifiers,
} from '@helpers/hero/skill-modifier';
import { characterSkillTreeNodeIds } from '@helpers/hero/skill-tree';
import { equippedItemTypes } from '@helpers/item/equipment';
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
  SkillPreviewContext,
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
  format: (value: number) => string,
): SkillModifierLineSegment {
  const status = getEntry<StatusEffectContent>(modifier.statusEffectId);
  return status
    ? {
        ...namedSegment(status.name, {
          sprite: status.sprite,
          spritesheet: 'statuseffect',
        }),
        statusEffect: statusEffectContentPreview(status, format),
      }
    : { text: modifier.statusEffectId };
}

function statusVerb(modifier: { statusEffectId: string }): string {
  const status = getEntry<StatusEffectContent>(modifier.statusEffectId);
  return status?.effectType === 'Buff' ? 'grant' : 'inflict';
}

function inflictSegments(
  modifier: HeroEffectSkillModifierInflict,
  format: (value: number) => string,
): SkillModifierLineSegment[] {
  const hits = modifier.onElement ? ` on ${modifier.onElement} hits` : '';
  return [
    { text: `${format(modifier.chance)}% chance to ${statusVerb(modifier)}` },
    statusSegment(modifier, format),
    { text: `for ${turnsText(modifier.duration, format)}${hits}` },
  ];
}

// Same sentence as an inflict line, with + marking a boost to a status the skill already has.
function potencySegments(
  modifier: HeroEffectSkillModifierPotency,
  format: (value: number) => string,
): SkillModifierLineSegment[] {
  const turns = `+${turnsText(modifier.duration, format)}`;
  if (!modifier.chance) {
    return [{ text: `${turns} of` }, statusSegment(modifier, format)];
  }

  const chance = {
    text: `+${format(modifier.chance)}% chance to ${statusVerb(modifier)}`,
  };
  return modifier.duration
    ? [chance, statusSegment(modifier, format), { text: `for ${turns}` }]
    : [chance, statusSegment(modifier, format)];
}

// An echo rides along on the parent's cast, so it pays no costs and has no timing of its own.
function echoedSkill(skill: EquipmentSkillContent): EquipmentSkillContent {
  return {
    ...skill,
    delay: 0,
    cooldown: 0,
    special: false,
    elementCosts: ensureElementBlock(),
  };
}

function echoSegments(
  modifier: HeroEffectSkillModifierEcho,
): SkillModifierLineSegment[] {
  const skill = getEntry<EquipmentSkillContent>(modifier.skillId);
  return [
    { text: 'Also casts' },
    skill
      ? {
          ...namedSegment(skill.name, {
            sprite: skill.sprite,
            spritesheet: 'skill',
          }),
          skill: echoedSkill(skill),
        }
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

export function characterSkillPreviewContext(
  character: Character,
): SkillPreviewContext {
  return {
    combatant: combatantFromCharacter(character),
    weaponTypes: equippedItemTypes(character.equipment),
  };
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
