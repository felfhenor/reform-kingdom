import { skillEpCost, skillIsUsableWithEquippedWeapons } from '@helpers/skill';
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
    requiredWeaponTypes: [],
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

describe('skillIsUsableWithEquippedWeapons', () => {
  it('is usable when the skill has no weapon requirement', () => {
    const skill = buildSkill({ requiredWeaponTypes: [] });
    expect(skillIsUsableWithEquippedWeapons(skill, [])).toBe(true);
  });

  it('is usable when one of the equipped weapon types matches', () => {
    const skill = buildSkill({ requiredWeaponTypes: ['Bow'] });
    expect(skillIsUsableWithEquippedWeapons(skill, ['Sword', 'Bow'])).toBe(
      true,
    );
  });

  it('is not usable when none of the equipped weapon types match', () => {
    const skill = buildSkill({ requiredWeaponTypes: ['Bow'] });
    expect(skillIsUsableWithEquippedWeapons(skill, ['Sword'])).toBe(false);
  });

  it('is not usable when nothing is equipped and a weapon is required', () => {
    const skill = buildSkill({ requiredWeaponTypes: ['Bow'] });
    expect(skillIsUsableWithEquippedWeapons(skill, [])).toBe(false);
  });

  it('is usable when any one of multiple required weapon types is equipped', () => {
    const skill = buildSkill({ requiredWeaponTypes: ['Bow', 'Staff'] });
    expect(skillIsUsableWithEquippedWeapons(skill, ['Staff'])).toBe(true);
  });
});
