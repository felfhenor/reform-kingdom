import {
  skillDescriptionWithPreview,
  skillTechniquePreviewValue,
} from '@helpers/skill-preview';
import type {
  Combatant,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  StatBlock,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

function buildCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'combatant-1',
    name: 'Test Combatant',
    isEnemy: false,
    level: 1,
    hp: 100,
    ep: 10,
    sprite: '0000',
    frames: 4,
    targettingType: 'Random',
    baseStats: {} as never,
    statBoosts: {} as never,
    totalStats: {
      Agility: 0,
      Energy: 0,
      Health: 100,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 0,
      Vitality: 0,
    } as StatBlock,
    combatStats: {} as never,
    resistance: { Fire: 0, Water: 0, Earth: 0, Air: 0 },
    affinity: { Fire: 0, Water: 0, Earth: 0, Air: 0 },
    skillIds: [],
    skillRefs: [],
    skillWeights: {},
    combatOrders: [],
    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
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
    family: 'Test Skill',
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
    const combatant = buildCombatant({
      totalStats: {
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
    expect(skillTechniquePreviewValue(combatant, skill, technique)).toBe(60);
  });

  it('floors a fractional result', () => {
    const combatant = buildCombatant({
      totalStats: {
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
    expect(skillTechniquePreviewValue(combatant, skill, technique)).toBe(50);
  });

  it('returns 0 for a technique with no damage scaling', () => {
    const combatant = buildCombatant();
    const skill = buildSkill();
    const technique = buildTechnique();

    expect(skillTechniquePreviewValue(combatant, skill, technique)).toBe(0);
  });
});

describe('skillDescriptionWithPreview', () => {
  it('substitutes {{ value }} with the previewed amount', () => {
    const combatant = buildCombatant({
      totalStats: {
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

    expect(skillDescriptionWithPreview(combatant, skill)).toBe(
      'Heal a living ally for 50 HP.',
    );
  });

  it('leaves a description with no placeholder unchanged', () => {
    const combatant = buildCombatant();
    const skill = buildSkill({
      description: 'Boost the Vitality of an ally!',
      techniques: [buildTechnique({ attributes: ['Buff'] })],
    });

    expect(skillDescriptionWithPreview(combatant, skill)).toBe(
      'Boost the Vitality of an ally!',
    );
  });

  it('returns the raw description when the skill has no techniques', () => {
    const combatant = buildCombatant();
    const skill = buildSkill({ description: 'No effect.', techniques: [] });

    expect(skillDescriptionWithPreview(combatant, skill)).toBe('No effect.');
  });
});
