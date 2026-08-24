import { statusEffectTagResistance } from '@helpers/combat/combat-statuseffects';
import type { Combatant, StatusEffectTag } from '@interfaces';
import { describe, expect, it } from 'vitest';

function buildTagResistance(
  overrides: Partial<Record<StatusEffectTag, number>> = {},
): Record<StatusEffectTag, number> {
  return {
    Stun: 0,
    StatDown: 0,
    Accuracy: 0,
    DamageOverTime: 0,
    Poison: 0,
    Burn: 0,
    ...overrides,
  };
}

describe('statusEffectTagResistance', () => {
  it('returns 0 when the effect has no tags', () => {
    const combatant = {
      tagResistance: buildTagResistance({ Stun: 50 }),
    } as Combatant;
    expect(statusEffectTagResistance(combatant, [])).toBe(0);
  });

  it('returns the matching resistance for a single-tag effect', () => {
    const combatant = {
      tagResistance: buildTagResistance({ Poison: 6 }),
    } as Combatant;
    expect(statusEffectTagResistance(combatant, ['Poison'])).toBe(6);
  });

  it('returns the highest resistance across a multi-tag effect, not the sum', () => {
    const combatant = {
      tagResistance: buildTagResistance({ StatDown: 3, Accuracy: 8 }),
    } as Combatant;
    expect(statusEffectTagResistance(combatant, ['StatDown', 'Accuracy'])).toBe(
      8,
    );
  });

  it('returns 0 for a tag the combatant has no resistance to', () => {
    const combatant = { tagResistance: buildTagResistance() } as Combatant;
    expect(statusEffectTagResistance(combatant, ['Stun'])).toBe(0);
  });
});
