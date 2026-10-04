import {
  mergeGrantedSkills,
  skillEpCost,
  skillIsUsableWithEquippedWeapons,
  skillTechniqueStatScaling,
  skillTechniqueWithStatBonuses,
} from '@helpers/hero/skill';
import { ensureStats } from '@helpers/content/ensure-helpers-stats';
import {
  ensureEquipmentSkillTechnique,
  ensureSkill,
} from '@helpers/content/ensure-skill';
import { buildEquipmentSkill } from '@/testing/builders';
import type {
  EquipmentSkillContentTechnique,
  EquipmentSkillId,
  StatBlock,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

function namedSkill(name: string) {
  return ensureSkill({ id: name as EquipmentSkillId, name });
}

function buildTechnique(
  damageScaling: Partial<StatBlock>,
  overrides: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return ensureEquipmentSkillTechnique({
    ...overrides,
    damageScaling: ensureStats(damageScaling),
  });
}

describe('skillEpCost', () => {
  it('returns the base epCost when there are no mods', () => {
    expect(skillEpCost(buildEquipmentSkill({ epCost: 5 }))).toBe(5);
  });

  it('adds the mods epCost boost on top of the base epCost', () => {
    const skill = buildEquipmentSkill({ epCost: 5, mods: { epCost: 3 } });
    expect(skillEpCost(skill)).toBe(8);
  });

  it('treats a missing mods epCost as zero', () => {
    const skill = buildEquipmentSkill({ epCost: 5, mods: {} });
    expect(skillEpCost(skill)).toBe(5);
  });
});

describe('skillIsUsableWithEquippedWeapons', () => {
  it('is usable when the skill has no weapon requirement', () => {
    const skill = buildEquipmentSkill({ requiredWeaponTypes: [] });
    expect(skillIsUsableWithEquippedWeapons(skill, [])).toBe(true);
  });

  it('is usable when one of the equipped weapon types matches', () => {
    const skill = buildEquipmentSkill({ requiredWeaponTypes: ['Bow'] });
    expect(skillIsUsableWithEquippedWeapons(skill, ['Sword', 'Bow'])).toBe(
      true,
    );
  });

  it('is not usable when none of the equipped weapon types match', () => {
    const skill = buildEquipmentSkill({ requiredWeaponTypes: ['Bow'] });
    expect(skillIsUsableWithEquippedWeapons(skill, ['Sword'])).toBe(false);
  });

  it('is not usable when nothing is equipped and a weapon is required', () => {
    const skill = buildEquipmentSkill({ requiredWeaponTypes: ['Bow'] });
    expect(skillIsUsableWithEquippedWeapons(skill, [])).toBe(false);
  });

  it('is usable when any one of multiple required weapon types is equipped', () => {
    const skill = buildEquipmentSkill({
      requiredWeaponTypes: ['Bow', 'Staff'],
    });
    expect(skillIsUsableWithEquippedWeapons(skill, ['Staff'])).toBe(true);
  });
});

describe('mergeGrantedSkills', () => {
  it('appends a granted skill the hero does not already know', () => {
    const attack = namedSkill('Attack');
    const starshine2 = namedSkill('Starshine II');

    expect(mergeGrantedSkills([attack], [starshine2])).toEqual([
      attack,
      starshine2,
    ]);
  });

  it('upgrades a known lower-tier skill of the same family in place', () => {
    const starshine1 = namedSkill('Starshine I');
    const starshine2 = namedSkill('Starshine II');

    expect(mergeGrantedSkills([starshine1], [starshine2])).toEqual([
      starshine2,
    ]);
  });

  it('ignores a granted skill when a same-or-higher tier is already known', () => {
    const starshine2 = namedSkill('Starshine II');
    const starshine1 = namedSkill('Starshine I');

    expect(mergeGrantedSkills([starshine2], [starshine1])).toEqual([
      starshine2,
    ]);
    expect(
      mergeGrantedSkills(
        [starshine2],
        [{ ...starshine2, id: 'starshine-2-gear' as EquipmentSkillId }],
      ),
    ).toEqual([starshine2]);
  });

  it('treats skills without a matching name family as unrelated', () => {
    const cure = namedSkill('Cure');
    const fireball = namedSkill('Fireball');

    expect(mergeGrantedSkills([cure], [fireball])).toEqual([cure, fireball]);
  });
});

describe('skillTechniqueStatScaling', () => {
  it('returns a single entry for a technique scaling from one stat', () => {
    expect(skillTechniqueStatScaling(buildTechnique({ Strength: 1 }))).toEqual([
      { stat: 'Strength', multiplier: 1 },
    ]);
  });

  it('returns multiple entries in StatOrder for a technique scaling from several stats', () => {
    const technique = buildTechnique({ Vitality: 0.5, Intelligence: 1 });

    expect(skillTechniqueStatScaling(technique)).toEqual([
      { stat: 'Intelligence', multiplier: 1 },
      { stat: 'Vitality', multiplier: 0.5 },
    ]);
  });

  it('omits stats with a zero multiplier', () => {
    const technique = buildTechnique({ Strength: 1, Intelligence: 0 });

    expect(skillTechniqueStatScaling(technique)).toEqual([
      { stat: 'Strength', multiplier: 1 },
    ]);
  });

  it('returns an empty array for a technique with no scaling', () => {
    expect(skillTechniqueStatScaling(buildTechnique({}))).toEqual([]);
  });
});

describe('skillTechniqueWithStatBonuses', () => {
  const fireball = buildEquipmentSkill({ family: 'Fireball' });

  it('adds the bonus onto the matching stat of a scaling technique', () => {
    const technique = buildTechnique({ Intelligence: 0.85 });

    const scaled = skillTechniqueWithStatBonuses(fireball, technique, [
      { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
      { skillFamily: 'Fireball', stat: 'Intelligence', value: 0.15 },
    ]);

    expect(scaled.damageScaling.Vitality).toBe(2);
    expect(scaled.damageScaling.Intelligence).toBeCloseTo(1);
  });

  it('does not mutate the source technique', () => {
    const technique = buildTechnique({ Intelligence: 0.85 });

    skillTechniqueWithStatBonuses(fireball, technique, [
      { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
    ]);

    expect(technique.damageScaling.Vitality).toBe(0);
  });

  it('ignores bonuses for other skill families', () => {
    const technique = buildTechnique({ Intelligence: 0.85 });

    expect(
      skillTechniqueWithStatBonuses(fireball, technique, [
        { skillFamily: 'Snipe', stat: 'Agility', value: 0.5 },
      ]),
    ).toBe(technique);
  });

  it('leaves techniques with no stat scaling untouched', () => {
    const technique = buildTechnique({}, { attributes: ['Buff'] });

    expect(
      skillTechniqueWithStatBonuses(fireball, technique, [
        { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
      ]),
    ).toBe(technique);
  });

  it('returns the technique unchanged when there are no bonuses', () => {
    const technique = buildTechnique({ Intelligence: 0.85 });

    expect(skillTechniqueWithStatBonuses(fireball, technique)).toBe(technique);
  });

  it('never drops a stat below zero scaling', () => {
    const technique = buildTechnique({ Intelligence: 0.5 });

    const scaled = skillTechniqueWithStatBonuses(fireball, technique, [
      { skillFamily: 'Fireball', stat: 'Intelligence', value: -2 },
    ]);

    expect(scaled.damageScaling.Intelligence).toBe(0);
  });
});
