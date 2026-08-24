import {
  combatOrderConditionMatches,
  isCombatOrderFamilyEquipmentOnly,
  isCombatOrderFamilyKnown,
  isCombatOrderFamilyUsable,
  isCombatOrderTargetModeUsable,
  pickSkillFromCombatOrders,
  resolveFamilyToSkill,
} from '@helpers/combat/combat-order-evaluation';
import type {
  Combat,
  Combatant,
  CombatOrderCondition,
  EquipmentSkill,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

function buildCombat(overrides: Partial<Combat> = {}): Combat {
  return {
    id: 'combat-1' as never,
    locationName: 'Field Ruins',
    locationPosition: { x: 0, y: 0 },
    rounds: 1,
    heroes: [],
    guardians: [],
    ...overrides,
  };
}

function buildCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'combatant-1',
    name: 'Combatant',
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
      Energy: 100,
      Health: 100,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 0,
      Vitality: 0,
    },
    combatStats: {} as never,
    resistance: {} as never,
    affinity: { Fire: 0, Water: 0, Earth: 0, Air: 0 },
    tagResistance: {} as never,
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

function buildSkill(overrides: Partial<EquipmentSkill> = {}): EquipmentSkill {
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
    targetType: 'Allies',
    targetBehaviors: [{ behavior: 'Always' }],
    damageScaling: {} as never,
    elements: [],
    attributes: [],
    statusEffects: [],
    combatMessage: '',
    ...overrides,
  };
}

describe('resolveFamilyToSkill', () => {
  it('finds the available skill matching the given family', () => {
    const cure = buildSkill({ id: 'cure' as never, family: 'Cure' });
    const fireball = buildSkill({
      id: 'fireball' as never,
      family: 'Fireball',
    });

    expect(resolveFamilyToSkill('Fireball', [cure, fireball])).toBe(fireball);
  });

  it('returns undefined when no available skill matches the family', () => {
    const cure = buildSkill({ id: 'cure' as never, family: 'Cure' });

    expect(resolveFamilyToSkill('Fireball', [cure])).toBeUndefined();
  });
});

describe('combatOrderConditionMatches', () => {
  const combat = buildCombat();

  it('Always always matches', () => {
    expect(
      combatOrderConditionMatches({ type: 'Always' }, combat, buildCombatant()),
    ).toBe(true);
  });

  it('SelfHealthPercent compares current HP% against the threshold', () => {
    const combatant = buildCombatant({
      hp: 50,
      totalStats: { ...buildCombatant().totalStats, Health: 100 },
    });
    const condition: CombatOrderCondition = {
      type: 'SelfHealthPercent',
      comparator: 'LessThan',
      value: 51,
    };

    expect(combatOrderConditionMatches(condition, combat, combatant)).toBe(
      true,
    );
    expect(
      combatOrderConditionMatches(
        { ...condition, value: 50 },
        combat,
        combatant,
      ),
    ).toBe(false);
    expect(
      combatOrderConditionMatches(
        { ...condition, comparator: 'LessThanOrEqual', value: 50 },
        combat,
        combatant,
      ),
    ).toBe(true);
  });

  it('SelfEnergyPercent compares current EP% against the threshold', () => {
    const combatant = buildCombatant({
      ep: 25,
      totalStats: { ...buildCombatant().totalStats, Energy: 100 },
    });

    expect(
      combatOrderConditionMatches(
        { type: 'SelfEnergyPercent', comparator: 'GreaterThan', value: 20 },
        combat,
        combatant,
      ),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        { type: 'SelfEnergyPercent', comparator: 'GreaterThan', value: 25 },
        combat,
        combatant,
      ),
    ).toBe(false);
  });

  it('AllyCountHealthPercent (Below) counts the caster as its own ally and excludes the dead', () => {
    const caster = buildCombatant({ id: 'caster', hp: 40 });
    const lowHpAlly = buildCombatant({ id: 'low', hp: 10 });
    const deadAlly = buildCombatant({ id: 'dead', hp: 0 });
    const healthyAlly = buildCombatant({ id: 'healthy', hp: 100 });

    const combatWithAllies = buildCombat({
      heroes: [caster, lowHpAlly, deadAlly, healthyAlly],
    });

    // caster (40%) and low (10%) are both below 75%; dead is excluded entirely.
    expect(
      combatOrderConditionMatches(
        {
          type: 'AllyCountHealthPercent',
          healthDirection: 'Below',
          healthPercent: 75,
          comparator: 'GreaterThanOrEqual',
          count: 2,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        {
          type: 'AllyCountHealthPercent',
          healthDirection: 'Below',
          healthPercent: 75,
          comparator: 'GreaterThanOrEqual',
          count: 3,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(false);
  });

  it('AllyCountHealthPercent (Above) counts allies strictly above the threshold', () => {
    const caster = buildCombatant({ id: 'caster', hp: 40 });
    const lowHpAlly = buildCombatant({ id: 'low', hp: 10 });
    const healthyAlly = buildCombatant({ id: 'healthy', hp: 100 });

    const combatWithAllies = buildCombat({
      heroes: [caster, lowHpAlly, healthyAlly],
    });

    // Only healthy (100%) is above 75%.
    expect(
      combatOrderConditionMatches(
        {
          type: 'AllyCountHealthPercent',
          healthDirection: 'Above',
          healthPercent: 75,
          comparator: 'Equal',
          count: 1,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(true);
  });

  it('SpecificHeroHealthPercent compares the named hero (not the caster) against the threshold', () => {
    const caster = buildCombatant({ id: 'caster', hp: 100 });
    const target = buildCombatant({ id: 'target', hp: 20 });
    const combatWithAllies = buildCombat({ heroes: [caster, target] });

    expect(
      combatOrderConditionMatches(
        {
          type: 'SpecificHeroHealthPercent',
          characterId: 'target' as never,
          comparator: 'LessThan',
          value: 50,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        {
          type: 'SpecificHeroHealthPercent',
          characterId: 'target' as never,
          comparator: 'GreaterThan',
          value: 50,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(false);
  });

  it('SpecificHeroHealthPercent is false when the named hero is dead or missing from the party', () => {
    const caster = buildCombatant({ id: 'caster', hp: 100 });
    const deadTarget = buildCombatant({ id: 'dead-target', hp: 0 });
    const combatWithAllies = buildCombat({ heroes: [caster, deadTarget] });
    const condition: CombatOrderCondition = {
      type: 'SpecificHeroHealthPercent',
      characterId: 'dead-target' as never,
      comparator: 'LessThanOrEqual',
      value: 100,
    };

    expect(
      combatOrderConditionMatches(condition, combatWithAllies, caster),
    ).toBe(false);
    expect(
      combatOrderConditionMatches(
        { ...condition, characterId: 'not-in-party' as never },
        combatWithAllies,
        caster,
      ),
    ).toBe(false);
  });

  it('EnemyCount counts only living guardians against the given comparator', () => {
    const hero = buildCombatant({ id: 'hero', isEnemy: false });
    const aliveGuardian = buildCombatant({ id: 'g1', isEnemy: true, hp: 10 });
    const deadGuardian = buildCombatant({ id: 'g2', isEnemy: true, hp: 0 });

    const combatWithGuardians = buildCombat({
      heroes: [hero],
      guardians: [aliveGuardian, deadGuardian],
    });

    expect(
      combatOrderConditionMatches(
        { type: 'EnemyCount', comparator: 'Equal', count: 1 },
        combatWithGuardians,
        hero,
      ),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        { type: 'EnemyCount', comparator: 'Equal', count: 2 },
        combatWithGuardians,
        hero,
      ),
    ).toBe(false);
  });
});

describe('pickSkillFromCombatOrders', () => {
  const combat = buildCombat();

  it('returns undefined when there are no clauses configured', () => {
    const combatant = buildCombatant({ combatOrders: [] });

    expect(
      pickSkillFromCombatOrders(combat, combatant, [buildSkill()]),
    ).toBeUndefined();
  });

  it('skips disabled clauses', () => {
    const combatant = buildCombatant({
      combatOrders: [
        {
          id: 'c1' as never,
          enabled: false,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    expect(
      pickSkillFromCombatOrders(combat, combatant, [
        buildSkill({ family: 'Fireball' }),
      ]),
    ).toBeUndefined();
  });

  it('picks the first clause whose family resolves and whose condition matches', () => {
    const cure = buildSkill({ id: 'cure' as never, family: 'Cure' });
    const fireball = buildSkill({
      id: 'fireball' as never,
      family: 'Fireball',
    });
    const combatant = buildCombatant({
      hp: 100,
      combatOrders: [
        {
          id: 'c1' as never,
          enabled: true,
          condition: {
            type: 'SelfHealthPercent',
            comparator: 'LessThan',
            value: 50,
          },
          action: { type: 'CastSkillFamily', family: 'Cure' },
        },
        {
          id: 'c2' as never,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    // Full health, so the Cure clause's condition fails and falls through.
    expect(
      pickSkillFromCombatOrders(combat, combatant, [cure, fireball]),
    ).toEqual({ skill: fireball, targetMode: undefined });
  });

  it('falls through a matching clause whose skill is currently unavailable', () => {
    const fireball = buildSkill({
      id: 'fireball' as never,
      family: 'Fireball',
    });
    const combatant = buildCombatant({
      combatOrders: [
        {
          id: 'c1' as never,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Cure' },
        },
        {
          id: 'c2' as never,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    // "Cure" isn't in the available skill list (e.g. unequipped weapon).
    expect(pickSkillFromCombatOrders(combat, combatant, [fireball])).toEqual({
      skill: fireball,
      targetMode: undefined,
    });
  });

  it('threads the target-mode override from the matched clause', () => {
    const fireball = buildSkill({
      id: 'fireball' as never,
      family: 'Fireball',
    });
    const combatant = buildCombatant({
      combatOrders: [
        {
          id: 'c1' as never,
          enabled: true,
          condition: { type: 'Always' },
          action: {
            type: 'CastSkillFamily',
            family: 'Fireball',
            targetMode: 'Weakest',
          },
        },
      ],
    });

    expect(pickSkillFromCombatOrders(combat, combatant, [fireball])).toEqual({
      skill: fireball,
      targetMode: 'Weakest',
    });
  });

  it('falls through to the next clause when a Self override resolves to zero targets', () => {
    // Mirrors "target self with Fortify, skip if already buffed" - falls through instead of wasting the turn.
    const fortify = buildSkill({
      id: 'fortify' as never,
      family: 'Fortify',
      techniques: [
        buildTechnique({
          targetType: 'Allies',
          targetBehaviors: [
            {
              behavior: 'IfNotStatusEffect',
              statusEffectId: 'Invigorated' as never,
            },
          ],
        }),
      ],
    });
    const fireball = buildSkill({
      id: 'fireball' as never,
      family: 'Fireball',
      techniques: [buildTechnique({ targetType: 'Enemies' })],
    });

    const combatant = buildCombatant({
      id: 'caster',
      statusEffects: [{ id: 'Invigorated' } as never],
      combatOrders: [
        {
          id: 'c1' as never,
          enabled: true,
          condition: { type: 'Always' },
          action: {
            type: 'CastSkillFamily',
            family: 'Fortify',
            targetMode: 'Self',
          },
        },
        {
          id: 'c2' as never,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });
    // combat.heroes must hold this exact reference - Self matches by identity, not id.
    const combatWithCaster = buildCombat({ heroes: [combatant] });

    expect(
      pickSkillFromCombatOrders(combatWithCaster, combatant, [
        fortify,
        fireball,
      ]),
    ).toEqual({ skill: fireball, targetMode: undefined });
  });

  it('RandomSkill always matches and stops, uniformly picking an available skill', () => {
    const cure = buildSkill({ id: 'cure' as never, family: 'Cure' });
    const combatant = buildCombatant({
      combatOrders: [
        {
          id: 'c1' as never,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'RandomSkill' },
        },
      ],
    });

    expect(pickSkillFromCombatOrders(combat, combatant, [cure])).toEqual({
      skill: cure,
    });
  });

  it('RandomSkill returns undefined when nothing is currently available', () => {
    const combatant = buildCombatant({
      combatOrders: [
        {
          id: 'c1' as never,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'RandomSkill' },
        },
      ],
    });

    expect(pickSkillFromCombatOrders(combat, combatant, [])).toBeUndefined();
  });
});

describe('isCombatOrderFamilyKnown', () => {
  it('is true when a skill with the family exists in the given list', () => {
    const skills = [buildSkill({ family: 'Cure' }) as EquipmentSkillContent];
    expect(isCombatOrderFamilyKnown('Cure', skills)).toBe(true);
    expect(isCombatOrderFamilyKnown('Fireball', skills)).toBe(false);
  });
});

describe('isCombatOrderFamilyUsable', () => {
  it('is true only when the family is known and its weapon requirement is met', () => {
    const skills = [
      buildSkill({
        family: 'Snipe',
        requiredWeaponTypes: ['Bow'],
      }) as EquipmentSkillContent,
    ];

    expect(isCombatOrderFamilyUsable('Snipe', skills, ['Bow'])).toBe(true);
    expect(isCombatOrderFamilyUsable('Snipe', skills, ['Sword'])).toBe(false);
    expect(isCombatOrderFamilyUsable('Cure', skills, ['Bow'])).toBe(false);
  });
});

describe('isCombatOrderFamilyEquipmentOnly', () => {
  it('is true when the family is absent from the job-only skill list', () => {
    const jobOnlySkills = [
      buildSkill({ family: 'Attack' }) as EquipmentSkillContent,
    ];

    expect(isCombatOrderFamilyEquipmentOnly('Starshine', jobOnlySkills)).toBe(
      true,
    );
    expect(isCombatOrderFamilyEquipmentOnly('Attack', jobOnlySkills)).toBe(
      false,
    );
  });
});

describe('isCombatOrderTargetModeUsable', () => {
  it('is true for Random/Strongest/Weakest/default regardless of the family', () => {
    const skills = [
      buildSkill({
        family: 'Fireball',
        techniques: [buildTechnique({ targetType: 'Enemies' })],
      }) as EquipmentSkillContent,
    ];

    expect(isCombatOrderTargetModeUsable('Fireball', skills, undefined)).toBe(
      true,
    );
    expect(isCombatOrderTargetModeUsable('Fireball', skills, 'Random')).toBe(
      true,
    );
  });

  it('is false for Self when every technique is Enemies-only', () => {
    const skills = [
      buildSkill({
        family: 'Fireball',
        techniques: [buildTechnique({ targetType: 'Enemies' })],
      }) as EquipmentSkillContent,
    ];

    expect(isCombatOrderTargetModeUsable('Fireball', skills, 'Self')).toBe(
      false,
    );
  });

  it('is true for Self when a technique can include the caster', () => {
    const skills = [
      buildSkill({
        family: 'Fortify',
        techniques: [buildTechnique({ targetType: 'Allies' })],
      }) as EquipmentSkillContent,
    ];

    expect(isCombatOrderTargetModeUsable('Fortify', skills, 'Self')).toBe(true);
  });

  it('is false for SpecificHero/MatchingAllies when every technique is Enemies or Self only', () => {
    const skills = [
      buildSkill({
        family: 'Ward',
        techniques: [buildTechnique({ targetType: 'Self' })],
      }) as EquipmentSkillContent,
    ];

    expect(isCombatOrderTargetModeUsable('Ward', skills, 'SpecificHero')).toBe(
      false,
    );
    expect(
      isCombatOrderTargetModeUsable('Ward', skills, 'MatchingAllies'),
    ).toBe(false);
  });

  it('is true for SpecificHero/MatchingAllies when a technique can hit another ally', () => {
    const skills = [
      buildSkill({
        family: 'Starshine',
        techniques: [buildTechnique({ targetType: 'Allies' })],
      }) as EquipmentSkillContent,
    ];

    expect(
      isCombatOrderTargetModeUsable('Starshine', skills, 'SpecificHero'),
    ).toBe(true);
    expect(
      isCombatOrderTargetModeUsable('Starshine', skills, 'MatchingAllies'),
    ).toBe(true);
  });

  it('is true when the family is unknown (other warnings already cover that case)', () => {
    expect(isCombatOrderTargetModeUsable('Unknown', [], 'Self')).toBe(true);
  });
});
