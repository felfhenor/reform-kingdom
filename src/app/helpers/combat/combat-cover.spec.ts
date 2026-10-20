import type { Combatant } from '@interfaces';
import { describe, expect, it } from 'vitest';

import { combatCoveringAlly } from '@helpers/combat/combat-cover';
import { ensureEquipmentSkillTechnique } from '@helpers/content/ensure-skill';
import { defaultCombatStats } from '@helpers/defaults';
import { buildTestCombatant } from '@/testing/builders';

const attack = ensureEquipmentSkillTechnique({ attributes: ['DamagesTarget'] });

function hero(
  id: string,
  coverThreshold = 0,
  overrides: Partial<Combatant> = {},
): Combatant {
  return buildTestCombatant({
    id,
    combatStats: { ...defaultCombatStats(), coverThreshold },
    ...overrides,
  });
}

// Test combatants have 100 max HP, so hp reads as a percentage.
const wounded = (id: string, overrides: Partial<Combatant> = {}) =>
  hero(id, 0, { hp: 5, ...overrides });

const monster = buildTestCombatant({ id: 'monster', isEnemy: true });

// The party is the technique's whole valid target pool and party[0] the intended target.
function cover(party: Combatant[], numTargets = 1, technique = attack) {
  return combatCoveringAlly(monster, party[0], party, technique, numTargets);
}

describe('combatCoveringAlly', () => {
  it('covers a target strictly below the threshold', () => {
    const guard = hero('g', 10);

    expect(cover([hero('t', 0, { hp: 9 }), guard])).toBe(guard);
    expect(cover([hero('t', 0, { hp: 10 }), guard])).toBeUndefined();
  });

  it('picks the first eligible ally', () => {
    const [low, first, second] = [hero('l', 3), hero('a', 10), hero('b', 10)];

    expect(cover([wounded('t'), low, first, second])).toBe(first);
  });

  it('only uses living, able-to-act allies with a threshold', () => {
    const party = [
      wounded('t'),
      hero('dead', 50, { hp: 0 }),
      hero('frozen', 50, { statusEffectData: { isFrozen: true } }),
      hero('none'),
    ];

    expect(cover(party)).toBeUndefined();
  });

  it("skips allies the technique couldn't have targeted", () => {
    const target = wounded('t');

    expect(
      combatCoveringAlly(monster, target, [target], attack, 1),
    ).toBeUndefined();
  });

  it('never covers a taunting target', () => {
    const taunter = wounded('t', {
      combatStats: { ...defaultCombatStats(), agroValue: 10 },
    });

    expect(cover([taunter, hero('a', 100)])).toBeUndefined();
  });

  it("lets a confused attacker's side-mates cover, but never the attacker", () => {
    const [confused, target, guard] = [
      hero('c', 100, { hp: 5 }),
      wounded('t'),
      hero('g', 100),
    ];
    const pool = [confused, target, guard];

    expect(combatCoveringAlly(confused, target, pool, attack, 1)).toBe(guard);
    expect(
      combatCoveringAlly(confused, confused, pool, attack, 1),
    ).toBeUndefined();
  });

  it('only covers with side-mates of the target, on either side', () => {
    const goblin = buildTestCombatant({ id: 'goblin', isEnemy: true, hp: 5 });
    const brute = buildTestCombatant({
      id: 'brute',
      isEnemy: true,
      combatStats: { ...defaultCombatStats(), coverThreshold: 10 },
    });
    const attacker = hero('h', 100);

    expect(
      combatCoveringAlly(
        attacker,
        goblin,
        [goblin, brute, hero('x', 100)],
        attack,
        1,
      ),
    ).toBe(brute);
  });

  it('ignores multi-target and non-damaging techniques', () => {
    const party = [wounded('t'), hero('a', 100)];
    const buff = ensureEquipmentSkillTechnique({ attributes: [] });

    expect(cover(party, 2)).toBeUndefined();
    expect(cover(party, 1, buff)).toBeUndefined();
  });
});
