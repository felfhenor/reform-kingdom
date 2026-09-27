import {
  combatantMessageToken,
  combatLog,
  combatLogReset,
} from '@helpers/combat/combat-log';
import {
  combatantHasActiveStatusEffect,
  combatApplyStatusEffectToTarget,
  combatExpireCombatantStatusEffects,
  combatTickCombatantStatusEffects,
  combatUnapplyAllStatusEffects,
  statusEffectTagResistance,
} from '@helpers/combat/combat-statuseffects';
import { ensureStatusEffect } from '@helpers/content/ensure-statuseffect';
import type {
  Combat,
  Combatant,
  StatusEffect,
  StatusEffectBlock,
  StatusEffectId,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

function buildTagResistance(
  overrides: Partial<StatusEffectBlock> = {},
): StatusEffectBlock {
  return {
    Stun: 0,
    StatDown: 0,
    Accuracy: 0,
    DamageOverTime: 0,
    Poison: 0,
    Burn: 0,
    Bleed: 0,
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

    // Proves the id token (not the raw name) is embedded, that combatant.hp
    // reflects the just-applied burn damage rather than a stale snapshot, and
    // that the bolded id token got its icon token hoisted in front of it.
    expect(combatLog()[0].message).toBe(
      `@@icon-combatant-1@@**${combatantMessageToken(combatant)}** is burning for 10 damage (90/100 HP remaining).`,
    );
  });
});

describe('status effect ticking and expiry', () => {
  function buildStunned(duration: number): StatusEffect {
    return {
      ...ensureStatusEffect({
        id: 'stunned' as StatusEffectId,
        name: 'Stunned',
        effectType: 'Debuff',
        onApply: [
          { type: 'AddCombatStatNumber', combatStat: 'stunChance', value: 100 },
        ],
        onUnapply: [
          {
            type: 'TakeCombatStatNumber',
            combatStat: 'stunChance',
            value: 100,
          },
        ],
      }),
      duration,
      creatorStats: {} as StatusEffect['creatorStats'],
      targetStats: {} as StatusEffect['targetStats'],
    };
  }

  function buildCombatant(): Combatant {
    return {
      id: 'combatant-1',
      name: 'Ashen',
      hp: 100,
      totalStats: { Health: 100 },
      combatStats: { debuffIgnoreChance: 0, stunChance: 0 },
      statusEffects: [],
      statusEffectData: {},
    } as unknown as Combatant;
  }

  const combat = {
    id: 'combat-1',
    heroes: [],
    guardians: [],
  } as unknown as Combat;

  it('keeps a 1-turn effect applied through its final turn until it expires', () => {
    const combatant = buildCombatant();
    combatApplyStatusEffectToTarget(combat, combatant, buildStunned(1));

    combatTickCombatantStatusEffects(combat, combatant, 'TurnStart');

    expect(combatant.combatStats.stunChance).toBe(100);
    expect(combatantHasActiveStatusEffect(combatant, 'stunned')).toBe(false);

    combatExpireCombatantStatusEffects(combat, combatant);

    expect(combatant.combatStats.stunChance).toBe(0);
    expect(combatant.statusEffects).toEqual([]);
  });

  it('only ticks effects matching the trigger', () => {
    const combatant = buildCombatant();
    combatApplyStatusEffectToTarget(combat, combatant, buildStunned(2));

    combatTickCombatantStatusEffects(combat, combatant, 'TurnEnd');

    expect(combatant.statusEffects[0].duration).toBe(2);
  });

  it('replaces an effect in its final turn instead of refusing the reapplication', () => {
    const combatant = buildCombatant();
    combatApplyStatusEffectToTarget(combat, combatant, buildStunned(1));
    combatTickCombatantStatusEffects(combat, combatant, 'TurnStart');

    combatApplyStatusEffectToTarget(combat, combatant, buildStunned(3));
    combatExpireCombatantStatusEffects(combat, combatant);

    expect(combatant.statusEffects.map((s) => s.duration)).toEqual([3]);
    expect(combatant.combatStats.stunChance).toBe(100);
  });

  it('refuses to stack an effect that is still active', () => {
    const combatant = buildCombatant();
    combatApplyStatusEffectToTarget(combat, combatant, buildStunned(2));
    combatApplyStatusEffectToTarget(combat, combatant, buildStunned(3));

    expect(combatant.statusEffects.map((s) => s.duration)).toEqual([2]);
    expect(combatant.combatStats.stunChance).toBe(100);
  });

  it('clears effects when unapplying all, so they cannot be unapplied twice', () => {
    const combatant = buildCombatant();
    combatApplyStatusEffectToTarget(combat, combatant, buildStunned(1));

    combatUnapplyAllStatusEffects(combat, combatant);
    combatTickCombatantStatusEffects(combat, combatant, 'TurnStart');
    combatExpireCombatantStatusEffects(combat, combatant);

    expect(combatant.statusEffects).toEqual([]);
    expect(combatant.combatStats.stunChance).toBe(0);
  });
});
