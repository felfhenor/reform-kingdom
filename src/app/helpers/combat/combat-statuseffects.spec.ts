import {
  combatantMessageToken,
  combatLog,
  combatLogReset,
} from '@helpers/combat/combat-log';
import {
  combatApplyStatusEffectToTarget,
  statusEffectTagResistance,
} from '@helpers/combat/combat-statuseffects';
import type {
  Combat,
  Combatant,
  StatusEffect,
  StatusEffectTag,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

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

describe('combatApplyStatusEffectToTarget combat message rendering', () => {
  beforeEach(() => {
    combatLogReset();
  });

  it('embeds the combatant id token (not the raw name) and reflects post-effect HP', () => {
    const combatant = {
      id: 'combatant-1',
      name: 'Ashen',
      hp: 100,
      totalStats: { Health: 100 },
      combatStats: { debuffIgnoreChance: 0 },
      statusEffects: [],
      statusEffectData: {},
    } as unknown as Combatant;
    const combat = {
      id: 'combat-1',
      heroes: [combatant],
      guardians: [],
    } as unknown as Combat;
    const statusEffect = {
      id: 'burn',
      name: 'Burn',
      effectType: 'Debuff',
      onApply: [
        {
          type: 'TakeDamage',
          combatMessage:
            '**{{ combatant.name }}** is burning for {{ damage }} damage ({{ combatant.hp }}/{{ combatant.totalStats.Health }} HP remaining).',
        },
      ],
      onTick: [],
      onUnapply: [],
      statScaling: { Strength: 1 },
      useTargetStats: false,
      creatorStats: { Strength: 10 },
      targetStats: {},
    } as unknown as StatusEffect;

    combatApplyStatusEffectToTarget(combat, combatant, statusEffect);

    // Proves the id token (not the raw name) is embedded, and that
    // combatant.hp reflects the just-applied burn damage, not a stale snapshot.
    expect(combatLog()[0].message).toBe(
      `**${combatantMessageToken(combatant)}** is burning for 10 damage (90/100 HP remaining).`,
    );
  });
});
