import {
  combatTechniqueElements,
  elementalBoonFloor,
  elementalBoonMultiplier,
  elementalDamageMultiplier,
  elementalDamageText,
  elementalResistanceClamp,
  elementalResistMultiplier,
} from '@helpers/combat/combat-element';
import { defaultAffinities } from '@helpers/defaults';
import type { ElementBlock } from '@interfaces';
import { describe, expect, it } from 'vitest';

function block(overrides: Partial<ElementBlock> = {}): ElementBlock {
  return { ...defaultAffinities(), ...overrides };
}

describe('elementalResistanceClamp / elementalBoonFloor', () => {
  it('clamps resistance to [-100, 75]', () => {
    expect(
      elementalResistanceClamp(block({ Fire: 120, Water: -150, Earth: 30 })),
    ).toEqual(block({ Fire: 75, Water: -100, Earth: 30 }));
  });

  it('floors boons at 0', () => {
    expect(elementalBoonFloor(block({ Fire: -10, Air: 20 }))).toEqual(
      block({ Air: 20 }),
    );
  });
});

describe('combatTechniqueElements', () => {
  it("prefers the technique's own elements over gear", () => {
    expect(
      combatTechniqueElements(
        { gearElements: ['Water'] },
        { elements: ['Fire'] },
      ),
    ).toEqual(['Fire']);
  });

  it('falls back to gear elements for a non-elemental technique', () => {
    expect(
      combatTechniqueElements(
        { gearElements: ['Water', 'Air'] },
        { elements: [] },
      ),
    ).toEqual(['Water', 'Air']);
  });

  it('is empty when neither the technique nor gear has an element (e.g. a pre-feature save)', () => {
    expect(combatTechniqueElements({}, { elements: [] })).toEqual([]);
  });
});

describe('elemental multipliers', () => {
  const attacker = { affinity: block({ Fire: 20 }) };
  const target = { resistance: block({ Fire: 50, Water: -50 }) };

  it('is a no-op for non-elemental hits', () => {
    expect(elementalDamageMultiplier(attacker, target, [])).toBe(1);
    expect(elementalResistMultiplier(target, [])).toBe(1);
    expect(elementalBoonMultiplier(attacker, [])).toBe(1);
  });

  it('combines boon and resistance multiplicatively per element', () => {
    expect(elementalDamageMultiplier(attacker, target, ['Fire'])).toBeCloseTo(
      1.2 * 0.5,
    );
  });

  it('amplifies damage against a weakness', () => {
    expect(elementalResistMultiplier(target, ['Water'])).toBe(1.5);
  });

  it('averages across every applied element', () => {
    expect(
      elementalDamageMultiplier(attacker, target, ['Fire', 'Water']),
    ).toBeCloseTo((1.2 * 0.5 + 1 * 1.5) / 2);
  });
});

describe('elementalDamageText', () => {
  it('names the element(s), or falls back to plain damage', () => {
    expect(elementalDamageText(12, ['Fire'])).toBe('12 Fire damage');
    expect(elementalDamageText(12, ['Fire', 'Water'])).toBe(
      '12 Fire/Water damage',
    );
    expect(elementalDamageText(0, [])).toBe('0 damage');
  });
});
