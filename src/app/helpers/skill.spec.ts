import { skillEpCost } from '@helpers/skill';
import type { EquipmentSkill } from '@interfaces';
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
    ...overrides,
  };
}

describe('skillEpCost', () => {
  it('returns the base epCost when there are no mods', () => {
    expect(skillEpCost(buildSkill({ epCost: 5 }))).toBe(5);
  });

  it('adds the mods epCost boost on top of the base epCost', () => {
    const skill = buildSkill({ epCost: 5, mods: { epCost: 3 } });
    expect(skillEpCost(skill)).toBe(8);
  });

  it('treats a missing mods epCost as zero', () => {
    const skill = buildSkill({ epCost: 5, mods: {} });
    expect(skillEpCost(skill)).toBe(5);
  });
});
