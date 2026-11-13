import { skillElementVerdict } from '@helpers/combat/combat-element-verdict';
import { ensureEquipmentSkillTechnique } from '@helpers/content/ensure-skill';
import { defaultAffinities } from '@helpers/defaults';
import type {
  EquipmentSkillAttribute,
  ElementBlock,
  GameElement,
} from '@interfaces';
import { buildEquipmentSkill, buildTestCombatant } from '@/testing/builders';
import { describe, expect, it } from 'vitest';

function block(overrides: Partial<ElementBlock> = {}): ElementBlock {
  return { ...defaultAffinities(), ...overrides };
}

function skill(
  elements: GameElement[],
  attributes: EquipmentSkillAttribute[] = ['DamagesTarget'],
) {
  return buildEquipmentSkill({
    techniques: [ensureEquipmentSkillTechnique({ elements, attributes })],
  });
}

const hero = buildTestCombatant({ affinity: block() });

describe('skillElementVerdict', () => {
  it('reads resistance as Resist and a negative one as Weak', () => {
    const target = buildTestCombatant({
      resistance: block({ Fire: 50, Water: -50 }),
    });

    expect(skillElementVerdict(hero, target, skill(['Fire']))).toBe('Resist');
    expect(skillElementVerdict(hero, target, skill(['Water']))).toBe('Weak');
    expect(skillElementVerdict(hero, target, skill(['Air']))).toBeUndefined();
  });

  it("lets the attacker's boon outweigh a small resistance", () => {
    const boosted = buildTestCombatant({ affinity: block({ Fire: 50 }) });
    const target = buildTestCombatant({ resistance: block({ Fire: 25 }) });

    expect(skillElementVerdict(boosted, target, skill(['Fire']))).toBe('Weak');
  });

  it("falls back to the attacker's weapon elements for a neutral attack", () => {
    const armed = buildTestCombatant({
      affinity: block(),
      gearElements: ['Earth'],
    });
    const target = buildTestCombatant({ resistance: block({ Earth: 50 }) });

    expect(skillElementVerdict(armed, target, skill([]))).toBe('Resist');
    expect(skillElementVerdict(hero, target, skill([]))).toBeUndefined();
  });

  it('ignores techniques that do not deal damage', () => {
    const target = buildTestCombatant({ resistance: block({ Fire: 50 }) });

    expect(
      skillElementVerdict(hero, target, skill(['Fire'], ['Debuff'])),
    ).toBeUndefined();
  });

  it('treats an even multi-element mix as neutral despite float drift', () => {
    const target = buildTestCombatant({
      resistance: block({ Fire: 30, Water: -40, Air: 10 }),
    });

    expect(
      skillElementVerdict(hero, target, skill(['Fire', 'Water', 'Air'])),
    ).toBeUndefined();
  });
});
