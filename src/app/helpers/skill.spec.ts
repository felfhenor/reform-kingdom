import {
  mergeGrantedSkills,
  skillEpCost,
  skillIsUsableWithEquippedWeapons,
  skillStatScaling,
} from '@helpers/skill';
import type {
  EquipmentSkill,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  StatBlock,
} from '@interfaces';
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

function buildSkillContent(
  overrides: Partial<EquipmentSkillContent> = {},
): EquipmentSkillContent {
  return buildSkill(overrides) as EquipmentSkillContent;
}

function buildTechnique(
  damageScaling: Partial<StatBlock>,
  overrides: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return {
    targets: 1,
    targetType: 'Enemies',
    targetBehaviors: [],
    damageScaling: damageScaling as StatBlock,
    elements: [],
    attributes: [],
    statusEffects: [],
    combatMessage: '',
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

describe('mergeGrantedSkills', () => {
  it('appends a granted skill the hero does not already know', () => {
    const attack = buildSkillContent({ id: 'attack' as never, name: 'Attack' });
    const starshine2 = buildSkillContent({
      id: 'starshine-2' as never,
      name: 'Starshine II',
    });

    expect(mergeGrantedSkills([attack], [starshine2])).toEqual([
      attack,
      starshine2,
    ]);
  });

  it('upgrades a known lower-tier skill of the same family in place', () => {
    const starshine1 = buildSkillContent({
      id: 'starshine-1' as never,
      name: 'Starshine I',
    });
    const starshine2 = buildSkillContent({
      id: 'starshine-2' as never,
      name: 'Starshine II',
    });

    expect(mergeGrantedSkills([starshine1], [starshine2])).toEqual([
      starshine2,
    ]);
  });

  it('ignores a granted skill when a same-or-higher tier is already known', () => {
    const starshine2 = buildSkillContent({
      id: 'starshine-2' as never,
      name: 'Starshine II',
    });
    const starshine1 = buildSkillContent({
      id: 'starshine-1' as never,
      name: 'Starshine I',
    });

    expect(mergeGrantedSkills([starshine2], [starshine1])).toEqual([
      starshine2,
    ]);
    expect(mergeGrantedSkills([starshine2], [starshine2])).toEqual([
      starshine2,
    ]);
  });

  it('treats skills without a matching name family as unrelated', () => {
    const cure = buildSkillContent({ id: 'cure' as never, name: 'Cure' });
    const fireball = buildSkillContent({
      id: 'fireball' as never,
      name: 'Fireball',
    });

    expect(mergeGrantedSkills([cure], [fireball])).toEqual([cure, fireball]);
  });
});

describe('skillStatScaling', () => {
  it('returns a single entry for a skill scaling from one stat', () => {
    const skill = buildSkillContent({
      techniques: [buildTechnique({ Strength: 1 })],
    });

    expect(skillStatScaling(skill)).toEqual([
      { stat: 'Strength', multiplier: 1 },
    ]);
  });

  it('returns multiple entries in StatOrder for a skill scaling from several stats', () => {
    const skill = buildSkillContent({
      techniques: [buildTechnique({ Vitality: 0.5, Intelligence: 1 })],
    });

    expect(skillStatScaling(skill)).toEqual([
      { stat: 'Intelligence', multiplier: 1 },
      { stat: 'Vitality', multiplier: 0.5 },
    ]);
  });

  it('omits stats with a zero multiplier', () => {
    const skill = buildSkillContent({
      techniques: [buildTechnique({ Strength: 1, Intelligence: 0 })],
    });

    expect(skillStatScaling(skill)).toEqual([
      { stat: 'Strength', multiplier: 1 },
    ]);
  });

  it('sums a stat multiplier across multiple techniques', () => {
    const skill = buildSkillContent({
      techniques: [
        buildTechnique({ Strength: 1 }),
        buildTechnique({ Strength: 0.5, Luck: 2 }),
      ],
    });

    expect(skillStatScaling(skill)).toEqual([
      { stat: 'Strength', multiplier: 1.5 },
      { stat: 'Luck', multiplier: 2 },
    ]);
  });

  it('returns an empty array for a skill with no techniques', () => {
    const skill = buildSkillContent({ techniques: [] });

    expect(skillStatScaling(skill)).toEqual([]);
  });

  it('omits a stat whose multipliers cancel to zero across techniques', () => {
    const skill = buildSkillContent({
      techniques: [
        buildTechnique({ Strength: 1, Vitality: 1 }),
        buildTechnique({ Strength: -1 }),
      ],
    });

    expect(skillStatScaling(skill)).toEqual([
      { stat: 'Vitality', multiplier: 1 },
    ]);
  });
});
