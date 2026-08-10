import {
  skillDescriptionWithPreview,
  skillTechniquePreviewValue,
} from '@helpers/skill-preview';
import type {
  Character,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

function buildCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1' as never,
    name: 'Test Hero',
    level: 1,
    xp: { current: 0, maximum: 100 },
    jobId: 'job-1' as never,
    jobProgress: {},
    hp: 100,
    ep: 10,
    stats: {
      Agility: 0,
      Energy: 0,
      Health: 100,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 0,
      Vitality: 0,
    },
    equipment: {} as never,
    traitIds: [],
    ...overrides,
  };
}

function buildSkill(
  overrides: Partial<EquipmentSkillContent> = {},
): EquipmentSkillContent {
  return {
    id: 'skill-1' as never,
    name: 'Test Skill',
    __type: 'skill',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    epCost: 0,
    usesPerCombat: -1,
    statusEffectDurationBoost: {} as never,
    statusEffectChanceBoost: {} as never,
    techniques: [],
    requiredWeaponTypes: [],
    ...overrides,
  };
}

function buildTechnique(
  overrides: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return {
    targets: 1,
    targetType: 'Enemies',
    targetBehaviors: [],
    damageScaling: {
      Agility: 0,
      Energy: 0,
      Health: 0,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 0,
      Vitality: 0,
    },
    elements: [],
    attributes: ['DamagesTarget'],
    statusEffects: [],
    combatMessage: '',
    ...overrides,
  };
}

describe('skillTechniquePreviewValue', () => {
  it('sums each scaled stat using the same formula as live combat', () => {
    const character = buildCharacter({
      stats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 100,
        Luck: 0,
        Resistance: 0,
        Strength: 0,
        Vitality: 40,
      },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: {
        Agility: 0,
        Energy: 0,
        Health: 0,
        Intelligence: 0.5,
        Luck: 0,
        Resistance: 0,
        Strength: 0,
        Vitality: 0.25,
      },
    });

    // Intelligence(100)*0.5 = 50; Vitality(40)*0.25 = 10.
    expect(skillTechniquePreviewValue(character, skill, technique)).toBe(60);
  });

  it('floors a fractional result', () => {
    const character = buildCharacter({
      stats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 101,
        Luck: 0,
        Resistance: 0,
        Strength: 0,
        Vitality: 0,
      },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: {
        Agility: 0,
        Energy: 0,
        Health: 0,
        Intelligence: 0.5,
        Luck: 0,
        Resistance: 0,
        Strength: 0,
        Vitality: 0,
      },
    });

    // 101*0.5 = 50.5 -> floored to 50.
    expect(skillTechniquePreviewValue(character, skill, technique)).toBe(50);
  });

  it('returns 0 for a technique with no damage scaling', () => {
    const character = buildCharacter();
    const skill = buildSkill();
    const technique = buildTechnique();

    expect(skillTechniquePreviewValue(character, skill, technique)).toBe(0);
  });
});

describe('skillDescriptionWithPreview', () => {
  it('substitutes {{ value }} with the previewed amount', () => {
    const character = buildCharacter({
      stats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 100,
        Luck: 0,
        Resistance: 0,
        Strength: 0,
        Vitality: 0,
      },
    });
    const skill = buildSkill({
      description: 'Heal a living ally for {{ value }} HP.',
      techniques: [
        buildTechnique({
          damageScaling: {
            Agility: 0,
            Energy: 0,
            Health: 0,
            Intelligence: 0.5,
            Luck: 0,
            Resistance: 0,
            Strength: 0,
            Vitality: 0,
          },
        }),
      ],
    });

    expect(skillDescriptionWithPreview(character, skill)).toBe(
      'Heal a living ally for 50 HP.',
    );
  });

  it('leaves a description with no placeholder unchanged', () => {
    const character = buildCharacter();
    const skill = buildSkill({
      description: 'Boost the Vitality of an ally!',
      techniques: [buildTechnique({ attributes: ['Buff'] })],
    });

    expect(skillDescriptionWithPreview(character, skill)).toBe(
      'Boost the Vitality of an ally!',
    );
  });

  it('returns the raw description when the skill has no techniques', () => {
    const character = buildCharacter();
    const skill = buildSkill({ description: 'No effect.', techniques: [] });

    expect(skillDescriptionWithPreview(character, skill)).toBe('No effect.');
  });
});
