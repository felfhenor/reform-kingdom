import type * as RngHelper from '@helpers/rng';
import type { Combatant } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngSucceedsChance: vi.fn(),
}));

import { combatCoveringAlly } from '@helpers/combat/combat-cover';
import { ensureEquipmentSkillTechnique } from '@helpers/content/ensure-skill';
import { defaultCombatStats } from '@helpers/defaults';
import { rngSucceedsChance } from '@helpers/rng';
import { buildTestCombatant } from '@/testing/builders';

const attack = ensureEquipmentSkillTechnique({ attributes: ['DamagesTarget'] });

function hero(
  id: string,
  coverChance = 0,
  overrides: Partial<Combatant> = {},
): Combatant {
  return buildTestCombatant({
    id,
    combatStats: { ...defaultCombatStats(), coverChance },
    ...overrides,
  });
}

const monster = buildTestCombatant({ id: 'monster', isEnemy: true });

// The party is the technique's whole valid target pool and party[0] the intended target.
function cover(party: Combatant[], numTargets = 1, technique = attack) {
  return combatCoveringAlly(monster, party[0], party, technique, numTargets);
}

beforeEach(() => {
  vi.mocked(rngSucceedsChance).mockReset().mockReturnValue(true);
});

describe('combatCoveringAlly', () => {
  it('returns the first ally whose cover roll lands', () => {
    vi.mocked(rngSucceedsChance).mockReturnValueOnce(false);
    const [target, first, second] = [hero('t'), hero('a', 5), hero('b', 5)];

    expect(cover([target, first, second])).toBe(second);
    expect(rngSucceedsChance).toHaveBeenCalledWith(5);
  });

  it('only rolls for living, able-to-act allies with cover chance', () => {
    const party = [
      hero('t', 50),
      hero('dead', 50, { hp: 0 }),
      hero('frozen', 50, { statusEffectData: { isFrozen: true } }),
      hero('none'),
    ];

    expect(cover(party)).toBeUndefined();
    expect(rngSucceedsChance).not.toHaveBeenCalled();
  });

  it("skips allies the technique couldn't have targeted", () => {
    const target = hero('t');

    expect(
      combatCoveringAlly(monster, target, [target], attack, 1),
    ).toBeUndefined();
    expect(rngSucceedsChance).not.toHaveBeenCalled();
  });

  it('never covers a taunting target', () => {
    const taunter = hero('t', 0, {
      combatStats: { ...defaultCombatStats(), agroValue: 10 },
    });

    expect(cover([taunter, hero('a', 100)])).toBeUndefined();
  });

  it("lets a confused attacker's side-mates cover, but never the attacker", () => {
    const [confused, target, guard] = [
      hero('c', 100),
      hero('t'),
      hero('g', 100),
    ];
    const pool = [confused, target, guard];

    expect(combatCoveringAlly(confused, target, pool, attack, 1)).toBe(guard);
    expect(
      combatCoveringAlly(confused, confused, pool, attack, 1),
    ).toBeUndefined();
  });

  it('only covers with side-mates of the target, on either side', () => {
    const goblin = buildTestCombatant({ id: 'goblin', isEnemy: true });
    const brute = buildTestCombatant({
      id: 'brute',
      isEnemy: true,
      combatStats: { ...defaultCombatStats(), coverChance: 10 },
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
    const party = [hero('t'), hero('a', 100)];
    const buff = ensureEquipmentSkillTechnique({ attributes: [] });

    expect(cover(party, 2)).toBeUndefined();
    expect(cover(party, 1, buff)).toBeUndefined();
  });

  it('is undefined when every roll fails', () => {
    vi.mocked(rngSucceedsChance).mockReturnValue(false);
    expect(cover([hero('t'), hero('a', 5)])).toBeUndefined();
  });
});
