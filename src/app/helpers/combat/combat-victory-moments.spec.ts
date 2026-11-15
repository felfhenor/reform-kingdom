import { describe, expect, it } from 'vitest';

import { combatVictoryMoments } from '@helpers/combat/combat-victory-moments';
import type { Combat } from '@interfaces';
import { buildCombat, buildTestCombatant } from '@/testing/builders';

// Test combatants have 100 Health, so hp reads as a percentage.
function won(overrides: Partial<Combat> = {}, ...heroHp: number[]) {
  return combatVictoryMoments(
    buildCombat({
      rounds: 1,
      heroes: (heroHp.length > 0 ? heroHp : [100]).map((hp, index) =>
        buildTestCombatant({ id: `hero-${index}`, hp }),
      ),
      guardians: [buildTestCombatant({ id: 'monster', isEnemy: true, hp: 0 })],
      ...overrides,
    }),
  );
}

const wonWith = (...heroHp: number[]) => won({}, ...heroHp);

describe('combatVictoryMoments', () => {
  it('marks nothing for an ordinary win', () => {
    expect(won()).toEqual([]);
  });

  it('marks a win in the ambush round', () => {
    expect(won({ rounds: 0 })).toEqual(['AmbushVictory']);
  });

  it('marks a win after a hero died covering an ally', () => {
    expect(won({ heroDiedCovering: true })).toEqual(['CoverDeathVictory']);
  });

  it("marks a win after a hero's retaliation killed an enemy", () => {
    expect(won({ heroRetaliationKill: true })).toEqual([
      'RetaliationKillVictory',
    ]);
  });

  it('marks a win with one hero left standing at 5% HP or less', () => {
    expect(wonWith(5, 0)).toEqual(['LastHeroStandingVictory']);
  });

  it('needs a party of two, one hero standing, and that hero nearly down', () => {
    expect(wonWith(1)).toEqual([]);
    expect(wonWith(5, 5)).toEqual([]);
    expect(wonWith(6, 0)).toEqual([]);
  });
});
