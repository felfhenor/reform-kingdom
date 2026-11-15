import type * as RngHelper from '@helpers/rng';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngSucceedsChance: vi.fn(),
}));

import {
  combatRollAmbush,
  combatWonInAmbushRound,
} from '@helpers/combat/combat-ambush';
import { rngSucceedsChance } from '@helpers/rng';
import type { Character, Combat } from '@interfaces';
import { buildCombat, buildTestCombatant } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';

function seedParty(party: Character[]): void {
  seedContent([
    ...abilityJobContent('Ranger', [
      ['Ambush', 1, 10],
      ['Ambush', 25, 20],
    ]),
    ...abilityJobContent('Warrior', []),
  ]);
  seedGamestate((state) => (state.world.party = party));
}

describe('combatRollAmbush', () => {
  it('never rolls without a Ranger', () => {
    seedParty([buildAbilityHero('Warrior', 30)]);

    expect(combatRollAmbush()).toBeUndefined();
    expect(rngSucceedsChance).not.toHaveBeenCalled();
  });

  it("rolls each Ranger's own chance, naming the first who succeeds", () => {
    seedParty([
      buildAbilityHero('Ranger', 1, {}, { name: 'Rin' }),
      buildAbilityHero('Ranger', 30, {}, { name: 'Tam' }),
    ]);
    vi.mocked(rngSucceedsChance)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    expect(combatRollAmbush()).toBe('Tam');
    expect(
      vi.mocked(rngSucceedsChance).mock.calls.map(([chance]) => chance),
    ).toEqual([10, 20]);
  });

  it('is undefined when every roll fails', () => {
    seedParty([buildAbilityHero('Ranger', 1)]);
    vi.mocked(rngSucceedsChance).mockReturnValue(false);

    expect(combatRollAmbush()).toBeUndefined();
  });
});

describe('combatWonInAmbushRound', () => {
  const ambushFight = (overrides: Partial<Combat> = {}) =>
    buildCombat({ guardians: [buildTestCombatant()], ...overrides });

  it('holds mid-ambush, or once only the ambush round has ended', () => {
    expect(
      combatWonInAmbushRound(
        ambushFight({ ambushedBy: 'Hero', turnQueue: [] }),
      ),
    ).toBe(true);
    expect(combatWonInAmbushRound(ambushFight())).toBe(true);
  });

  it('fails once a counted round has begun or ended, or with nothing to fight', () => {
    expect(combatWonInAmbushRound(ambushFight({ turnQueue: [] }))).toBe(false);
    expect(combatWonInAmbushRound(ambushFight({ rounds: 1 }))).toBe(false);
    expect(combatWonInAmbushRound(buildCombat())).toBe(false);
  });
});
