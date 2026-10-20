import { beforeEach, describe, expect, it } from 'vitest';

import {
  ensureEquipmentSkillTechnique,
  ensureSkill,
} from '@helpers/content/ensure-skill';
import { combatantFromCharacter } from '@helpers/combat/combat-create';
import { combatantSkills } from '@helpers/combat/combat-targetting';
import { characterSkills } from '@helpers/hero/job';
import {
  skillModifiersForFamily,
  skillOwnTechniques,
  skillWithModifiers,
} from '@helpers/hero/skill-modifier';
import { skillEpCost } from '@helpers/hero/skill';
import type {
  EquipmentSkillId,
  HeroEffectSkillModifier,
  JobId,
  StatusEffectId,
} from '@interfaces';
import { ensureJob } from '@helpers/content/ensure-job';
import { defaultEquipment } from '@helpers/defaults';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { buildEffectNode, heroLearning } from '@/testing/skill-tree';

const burning = 'burning' as StatusEffectId;
const blind = 'blind' as StatusEffectId;

const frostfire = ensureSkill({
  id: 'frostfire' as EquipmentSkillId,
  name: 'Frostfire I',
  family: 'Frostfire',
  techniques: [
    ensureEquipmentSkillTechnique({
      targets: 1,
      targetType: 'Enemies',
      elements: ['Fire'],
      damageScaling: { Intelligence: 1 } as never,
      statusEffects: [{ statusEffectId: burning, chance: 50, duration: 3 }],
    }),
    ensureEquipmentSkillTechnique({
      targets: 1,
      targetType: 'Enemies',
      elements: ['Water'],
    }),
  ],
});

const fortify = ensureSkill({
  id: 'fortify' as EquipmentSkillId,
  name: 'Fortify',
  family: 'Fortify',
  techniques: [ensureEquipmentSkillTechnique({ targetType: 'Allies' })],
});

function modifier(
  fields: Partial<HeroEffectSkillModifier>,
): HeroEffectSkillModifier {
  return {
    kind: 'SkillModifier',
    family: 'Frostfire',
    ...fields,
  } as HeroEffectSkillModifier;
}

beforeEach(() => {
  seedContent([frostfire, fortify]);
});

describe('skillWithModifiers', () => {
  it('returns the skill untouched without modifiers', () => {
    expect(skillWithModifiers(frostfire, [])).toBe(frostfire);
  });

  it('adds targets to every hit and records the modifiers', () => {
    const targets = modifier({ modifier: 'Targets', value: 1 });
    const skill = skillWithModifiers(frostfire, [targets]);

    expect(skill.techniques.map((tech) => tech.targets)).toEqual([2, 2]);
    expect(skill.modifiers).toEqual([targets]);
  });

  it('adds an element once', () => {
    const skill = skillWithModifiers(frostfire, [
      modifier({ modifier: 'Element', element: 'Fire' }),
    ]);

    expect(skill.techniques.map((tech) => tech.elements)).toEqual([
      ['Fire'],
      ['Water', 'Fire'],
    ]);
  });

  it('inflicts only on hits of its element when one is named', () => {
    const skill = skillWithModifiers(frostfire, [
      modifier({
        modifier: 'Inflict',
        statusEffectId: blind,
        chance: 25,
        duration: 2,
        onElement: 'Water',
      }),
    ]);

    expect(skill.techniques[0].statusEffects).toHaveLength(1);
    expect(skill.techniques[1].statusEffects).toEqual([
      { statusEffectId: blind, chance: 25, duration: 2 },
    ]);
  });

  it('adds scaling only to hits that already scale', () => {
    const skill = skillWithModifiers(frostfire, [
      modifier({ modifier: 'Scaling', stat: 'Spirit', value: 5 }),
    ]);

    expect(skill.techniques[0].damageScaling.Spirit).toBe(5);
    expect(skill.techniques[1].damageScaling.Spirit).toBe(0);
  });

  it('makes a sure hit undodgeable too', () => {
    const dodgeable = {
      ...frostfire,
      techniques: frostfire.techniques.map((tech) => ({
        ...tech,
        attributes: [
          'DamagesTarget',
          'AllowLuckDodge',
        ] as typeof tech.attributes,
      })),
    };
    const skill = skillWithModifiers(dodgeable, [
      modifier({ modifier: 'Attribute', attribute: 'NeverMisses' }),
    ]);

    expect(skill.techniques[0].attributes).toEqual([
      'DamagesTarget',
      'NeverMisses',
    ]);
  });

  it('gives its own hits an attribute once', () => {
    const skill = skillWithModifiers(frostfire, [
      modifier({ modifier: 'Attribute', attribute: 'NeverMisses' }),
      modifier({ modifier: 'Attribute', attribute: 'NeverMisses' }),
    ]);

    expect(
      skill.techniques.map((tech) =>
        tech.attributes.filter((attribute) => attribute === 'NeverMisses'),
      ),
    ).toEqual([['NeverMisses'], ['NeverMisses']]);
  });

  it('cuts the EP cost by a percent of the tier cost', () => {
    const pricey = { ...frostfire, epCost: 25 };
    const skill = skillWithModifiers(pricey, [
      modifier({ modifier: 'EpCost', value: 40 }),
    ]);

    expect(skillEpCost(skill)).toBe(15);
  });

  it('never cuts the EP cost below free', () => {
    const cheap = { ...frostfire, epCost: 10 };
    const cut = modifier({ modifier: 'EpCost', value: 60 });

    expect(skillEpCost(skillWithModifiers(cheap, [cut, cut]))).toBe(0);
  });

  it('raises accuracy up to a sure hit', () => {
    const shaky = {
      ...frostfire,
      techniques: frostfire.techniques.map((tech) => ({
        ...tech,
        accuracy: 70,
      })),
    };
    const accuracy = modifier({ modifier: 'Accuracy', value: 20 });

    expect(skillWithModifiers(shaky, [accuracy]).techniques[0].accuracy).toBe(
      90,
    );
    expect(
      skillWithModifiers(shaky, [accuracy, accuracy]).techniques[0].accuracy,
    ).toBe(100);
  });

  it('stacks potency into the status boosts', () => {
    const potency = modifier({
      modifier: 'Potency',
      statusEffectId: burning,
      chance: 10,
      duration: 1,
    });
    const skill = skillWithModifiers(frostfire, [potency, potency]);

    expect(skill.mods?.statusEffectChanceBoost?.[burning]).toBe(20);
    expect(skill.mods?.statusEffectDurationBoost?.[burning]).toBe(2);
    expect(skillEpCost(skill)).toBe(frostfire.epCost);
  });

  it('appends echoed hits after its own, marked as echoes', () => {
    const skill = skillWithModifiers(frostfire, [
      modifier({ modifier: 'Echo', skillId: fortify.id }),
    ]);

    expect(skill.techniques).toHaveLength(3);
    expect(skill.techniques[2]).toMatchObject({
      targetType: 'Allies',
      echoOf: fortify.id,
    });
    expect(skillOwnTechniques(skill)).toHaveLength(2);
  });
});

describe('skillModifiersForFamily', () => {
  it('keeps only skill modifiers for that family', () => {
    const fire = modifier({ modifier: 'Targets', value: 1 });
    const other = modifier({ family: 'Other', modifier: 'Targets', value: 1 });

    expect(
      skillModifiersForFamily(
        [fire, other, { kind: 'Stat', stat: 'Luck', value: 1 }],
        'Frostfire',
      ),
    ).toEqual([fire]);
  });
});

describe('characterSkills', () => {
  it('folds a learned modifier into the granted skill, naming its node', () => {
    const jobId = 'mage' as JobId;
    const grant = buildEffectNode('grant', [
      { kind: 'GrantSkill', skillId: frostfire.id },
    ]);
    const oath = buildEffectNode('Wide Bolt', [
      modifier({ modifier: 'Targets', value: 2 }),
    ]);
    seedContent([ensureJob({ id: jobId }), frostfire, grant, oath]);

    const skill = characterSkills(
      heroLearning(
        {
          jobId,
          level: 1,
          equipment: defaultEquipment(),
          teachings: {},
          skillTreeNodes: {},
        },
        grant,
        oath,
      ),
    ).find((entry) => entry.family === 'Frostfire');

    expect(skill?.techniques[0].targets).toBe(3);
    expect(skill?.modifiers?.[0].source).toBe('Wide Bolt');
  });
});

describe('combatantFromCharacter', () => {
  it('fights with the modified copy, not the content skill', () => {
    const jobId = 'mage' as JobId;
    const grant = buildEffectNode('grant', [
      { kind: 'GrantSkill', skillId: frostfire.id },
    ]);
    const oath = buildEffectNode('Wide Bolt', [
      modifier({ modifier: 'Targets', value: 2 }),
    ]);
    seedContent([ensureJob({ id: jobId }), frostfire, grant, oath]);

    const combatant = combatantFromCharacter(
      heroLearning(buildCharacter({ jobId }), grant, oath),
    );
    const skill = combatantSkills(combatant).find(
      (entry) => entry.family === 'Frostfire',
    );

    expect(skill?.techniques[0].targets).toBe(3);
  });
});

describe('burst skills', () => {
  it('fight with their modifiers too', () => {
    const jobId = 'mage' as JobId;
    const burst = { ...frostfire, special: true };
    const grant = buildEffectNode('grant', [
      { kind: 'GrantSkill', skillId: burst.id },
    ]);
    const oath = buildEffectNode('Wide Bolt', [
      modifier({ modifier: 'Targets', value: 2 }),
    ]);
    seedContent([ensureJob({ id: jobId }), burst, grant, oath]);

    const combatant = combatantFromCharacter(
      heroLearning(
        buildCharacter({ jobId, burstSkills: { [jobId]: [burst.id] } }),
        grant,
        oath,
      ),
    );
    const skill = combatantSkills(combatant).find(
      (entry) => entry.family === 'Frostfire',
    );

    expect(skill?.techniques[0].targets).toBe(3);
  });
});
