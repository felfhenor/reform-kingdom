import { combatAvailableSkillsForCombatant } from '@helpers/combat-targetting';
import type { Combatant, EquipmentSkill } from '@interfaces';
import { describe, expect, it } from 'vitest';

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

function buildCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'combatant-1',
    name: 'Combatant',
    isEnemy: false,
    level: 1,
    hp: 10,
    ep: 10,
    sprite: '0000',
    frames: 4,
    targettingType: 'Random',
    baseStats: {} as never,
    statBoosts: {} as never,
    totalStats: {} as never,
    combatStats: {} as never,
    resistance: {} as never,
    affinity: {} as never,
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

describe('combatAvailableSkillsForCombatant', () => {
  it('excludes skills whose epCost exceeds the combatant current ep', () => {
    const affordable = buildSkill({ id: 'cheap' as never, epCost: 5 });
    const tooExpensive = buildSkill({ id: 'expensive' as never, epCost: 15 });

    const combatant = buildCombatant({
      ep: 10,
      skillRefs: [affordable, tooExpensive],
    });

    const available = combatAvailableSkillsForCombatant(combatant);

    expect(available.map((s) => s.id)).toEqual(['cheap']);
  });

  it('includes a skill whose epCost exactly matches the combatant current ep', () => {
    const skill = buildSkill({ epCost: 10 });
    const combatant = buildCombatant({ ep: 10, skillRefs: [skill] });

    expect(combatAvailableSkillsForCombatant(combatant)).toEqual([skill]);
  });

  it('still excludes skills that are out of uses even if ep is available', () => {
    const skill = buildSkill({ id: 'limited' as never, epCost: 0, usesPerCombat: 1 });
    const combatant = buildCombatant({
      ep: 10,
      skillRefs: [skill],
      skillUses: { ['limited' as never]: 1 },
    });

    expect(combatAvailableSkillsForCombatant(combatant)).toEqual([]);
  });
});
