import { getEntry } from '@helpers/content/content';
import {
  skillDescriptionWithPreview,
  skillTechniqueKind,
  skillTechniquePreviews,
  skillTechniquePreviewValue,
  skillTechniqueTargeting,
} from '@helpers/hero/skill-preview';
import type {
  Combatant,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  StatBlock,
} from '@interfaces';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({ getEntry: vi.fn() }));

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
    targetting: [{ type: 'Random' }],
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
      Constitution: 0,
      Spirit: 0,
    } as StatBlock,
    combatStats: {} as never,
    resistance: { Fire: 0, Water: 0, Earth: 0, Air: 0 },
    affinity: { Fire: 0, Water: 0, Earth: 0, Air: 0 },
    tagResistance: {
      Stun: 0,
      StatDown: 0,
      Accuracy: 0,
      DamageOverTime: 0,
      Poison: 0,
      Burn: 0,
      Bleed: 0,
    },
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
      Constitution: 0,
      Spirit: 0,
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
        Constitution: 0,
        Spirit: 0,
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
        Constitution: 0,
        Spirit: 0,
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
        Constitution: 0,
        Spirit: 0,
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
        Constitution: 0,
        Spirit: 0,
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
        Constitution: 0,
        Spirit: 0,
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
            Constitution: 0,
            Spirit: 0,
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

function statBlock(overrides: Partial<StatBlock>): StatBlock {
  return { ...buildTechnique().damageScaling, ...overrides };
}

const leechSkill = buildSkill({
  description: 'Bite an enemy for {{ value }} damage, then heal self.',
  techniques: [
    buildTechnique({ damageScaling: statBlock({ Strength: 1, Agility: 1 }) }),
    buildTechnique({
      attributes: ['BypassDefense', 'NeverMisses', 'HealsTarget'],
      targetType: 'Self',
      targetBehaviors: [{ behavior: 'NotMaxHealth' }],
      damageScaling: statBlock({ Vitality: 0.5 }),
    }),
  ],
});

const leechCombatant = buildCombatant({
  totalStats: {
    ...buildCombatant().totalStats,
    Strength: 20,
    Agility: 10,
    Vitality: 40,
  },
});

describe('skillTechniqueKind', () => {
  it.each([
    [['DamagesTarget', 'Debuff'], 'Damage'],
    [['HealsTarget'], 'Heal'],
    [['Buff'], 'Buff'],
    [['Debuff'], 'Debuff'],
    [[], 'Effect'],
  ] as const)('classifies %j as %s', (attributes, expected) => {
    const technique = buildTechnique({ attributes: [...attributes] });

    expect(skillTechniqueKind(technique)).toBe(expected);
  });

  it('treats a debuff with non-zero scaling as damage, matching combat', () => {
    const technique = buildTechnique({
      attributes: ['Debuff'],
      damageScaling: statBlock({ Resistance: 1 }),
    });

    expect(skillTechniqueKind(technique)).toBe('Damage');
  });
});

describe('skillTechniqueTargeting', () => {
  const skill = buildSkill();

  it('names a single enemy and pluralizes multiples', () => {
    expect(
      skillTechniqueTargeting(skill, buildTechnique({ targets: 1 })),
    ).toEqual({ count: 1, noun: 'enemy' });
    expect(
      skillTechniqueTargeting(skill, buildTechnique({ targets: 3 })),
    ).toEqual({ count: 3, noun: 'enemies' });
  });

  it('describes self and all-combatant techniques without a count', () => {
    expect(
      skillTechniqueTargeting(skill, buildTechnique({ targetType: 'Self' })),
    ).toEqual({ noun: 'self' });
    expect(
      skillTechniqueTargeting(
        skill,
        buildTechnique({ targetType: 'All', targets: 25 }),
      ),
    ).toEqual({ noun: 'all combatants' });
  });

  it('treats a full-party ally technique as all allies', () => {
    expect(
      skillTechniqueTargeting(
        skill,
        buildTechnique({ targetType: 'Allies', targets: 4 }),
      ),
    ).toEqual({ noun: 'all allies' });
    expect(
      skillTechniqueTargeting(
        skill,
        buildTechnique({ targetType: 'Allies', targets: 2 }),
      ),
    ).toEqual({ count: 2, noun: 'allies' });
  });
});

describe('skillTechniquePreviews', () => {
  it('lists each technique in order with its own amount, target and scaling', () => {
    const previews = skillTechniquePreviews(leechCombatant, leechSkill);

    expect(previews).toHaveLength(2);
    expect(previews[0]).toMatchObject({
      kind: 'Damage',
      amount: 30,
      targeting: { count: 1, noun: 'enemy' },
      scaling: [
        { stat: 'Strength', multiplier: 1 },
        { stat: 'Agility', multiplier: 1 },
      ],
    });
    expect(previews[1]).toMatchObject({
      kind: 'Heal',
      amount: 20,
      targeting: { noun: 'self' },
      conditions: ['Only if wounded'],
      scaling: [{ stat: 'Vitality', multiplier: 0.5 }],
    });
  });

  it('resolves status effect names with chance and duration', () => {
    vi.mocked(getEntry).mockReturnValue({ name: 'Burning' } as never);
    const skill = buildSkill({
      techniques: [
        buildTechnique({
          statusEffects: [
            { statusEffectId: 'burning' as never, chance: 40, duration: 3 },
          ],
        }),
      ],
    });

    expect(
      skillTechniquePreviews(buildCombatant(), skill)[0].statusEffects,
    ).toEqual([{ name: 'Burning', chance: 40, duration: 3 }]);
  });

  it('describes target-status conditions by status effect name', () => {
    vi.mocked(getEntry).mockReturnValue({ name: 'Weakspot' } as never);
    const skill = buildSkill({
      techniques: [
        buildTechnique({
          attributes: ['Debuff'],
          targetBehaviors: [
            { behavior: 'NotZeroHealth' },
            {
              behavior: 'IfNotStatusEffect',
              statusEffectId: 'weakspot' as never,
            },
          ],
        }),
      ],
    });

    expect(
      skillTechniquePreviews(buildCombatant(), skill)[0].conditions,
    ).toEqual(['Only if it lacks Weakspot']);
  });

  it('reports no amount for a buff technique', () => {
    const skill = buildSkill({
      techniques: [buildTechnique({ attributes: ['Buff'] })],
    });

    expect(skillTechniquePreviews(buildCombatant(), skill)[0]).toMatchObject({
      kind: 'Buff',
      amount: 0,
    });
  });
});

describe('skillDescriptionWithPreview with mixed techniques', () => {
  it('counts a scaled debuff technique as damage', () => {
    const skill = buildSkill({
      description: 'Scream for {{ value }} magical damage.',
      techniques: [
        buildTechnique({
          attributes: ['Debuff'],
          damageScaling: statBlock({ Resistance: 1 }),
        }),
      ],
    });
    const combatant = buildCombatant({
      totalStats: { ...buildCombatant().totalStats, Resistance: 12 },
    });

    expect(skillDescriptionWithPreview(combatant, skill)).toBe(
      'Scream for 12 magical damage.',
    );
  });

  it('uses only the damage total when a skill also heals', () => {
    expect(skillDescriptionWithPreview(leechCombatant, leechSkill)).toBe(
      'Bite an enemy for 30 damage, then heal self.',
    );
  });
});
