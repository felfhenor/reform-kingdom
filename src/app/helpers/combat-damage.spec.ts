import { combatApplySkillToTarget } from '@helpers/combat-damage';
import type {
  Combat,
  Combatant,
  EquipmentSkill,
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
      Energy: 0,
      Health: 100,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 0,
      Vitality: 0,
    },
    combatStats: {
      repeatActionChance: 0,
      skillStrikeAgainChance: 0,
      skillAdditionalUseChance: 0,
      skillAdditionalUseCount: 0,
      redirectionChance: 0,
      missChance: 0,
      debuffIgnoreChance: 0,
      damageReflectPercent: 0,
      healingIgnorePercent: 0,
      reviveChance: 0,
      stunChance: 0,
    },
    resistance: {} as never,
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

describe('combatApplySkillToTarget defense', () => {
  it('mitigates a purely physical technique using only the target Vitality stat', () => {
    const attacker = buildCombatant({
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 0,
        Luck: 0,
        Resistance: 0,
        Strength: 100,
        Vitality: 0,
      },
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 1000,
        Intelligence: 0,
        Luck: 0,
        Resistance: 100,
        Strength: 0,
        Vitality: 20,
      },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: {
        Agility: 0,
        Energy: 0,
        Health: 0,
        Intelligence: 0,
        Luck: 0,
        Resistance: 0,
        Strength: 1,
        Vitality: 0,
      },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // baseDamage = Strength(100) * 1 = 100; defended purely by
    // Vitality (20), never by the target's much larger Resistance (100).
    expect(target.hp).toBe(1000 - (100 - 20));
  });

  it('mitigates a purely magical technique using only the target Resistance stat', () => {
    const attacker = buildCombatant({
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
    const target = buildCombatant({
      hp: 1000,
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 1000,
        Intelligence: 0,
        Luck: 0,
        Resistance: 20,
        Strength: 0,
        Vitality: 100,
      },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: {
        Agility: 0,
        Energy: 0,
        Health: 0,
        Intelligence: 1,
        Luck: 0,
        Resistance: 0,
        Strength: 0,
        Vitality: 0,
      },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // baseDamage = Intelligence(100) * 1 = 100; defended purely by
    // Resistance (20), never by the target's much larger Vitality (100).
    expect(target.hp).toBe(1000 - (100 - 20));
  });

  it('splits mitigation between Resistance and Vitality proportional to the damageScaling weights', () => {
    const attacker = buildCombatant({
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 100,
        Luck: 0,
        Resistance: 0,
        Strength: 100,
        Vitality: 0,
      },
    });
    const target = buildCombatant({
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 0,
        Luck: 0,
        Resistance: 100,
        Strength: 0,
        Vitality: 300,
      },
    });
    const skill = buildSkill();
    // 75% Strength / 25% Intelligence -> defense should be
    // 0.75 * Vitality(300) + 0.25 * Resistance(100) = 250.
    const technique = buildTechnique({
      damageScaling: {
        Agility: 0,
        Energy: 0,
        Health: 0,
        Intelligence: 0.25,
        Luck: 0,
        Resistance: 0,
        Strength: 0.75,
        Vitality: 0,
      },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // baseDamage = Strength(100) * 0.75 + Intelligence(100) * 0.25 = 100;
    // fully absorbed by defense (250), so no damage gets through.
    expect(target.hp).toBe(100 - Math.max(0, 100 - 250));
  });
});
