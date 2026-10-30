import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Always rolls the top of a range, so the max level must be reachable.
vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngNumberRange: vi.fn((_min: number, max: number) => max),
  rngSucceedsChance: vi.fn(() => false),
}));

import { combatLog } from '@helpers/combat/combat-log';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { encounterStartFight } from '@helpers/encounter/encounter';
import { rngNumberRange, rngSucceedsChance } from '@helpers/rng';
import { worldCombatState } from '@helpers/state-game';
import type { EncounterId, MonsterId } from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';

const goblin = ensureMonster({ id: 'goblin' as MonsterId, name: 'Goblin' });
const slime = ensureMonster({ id: 'slime' as MonsterId, name: 'Slime' });
const ruins = ensureEncounter({
  id: 'field-ruins' as EncounterId,
  name: 'Field Ruins',
  levelRange: { min: 1, max: 3 },
  fights: [
    { monsters: [{ monsterId: goblin.id }] },
    {
      monsters: [
        { monsterId: slime.id },
        { monsterId: 'gone' as MonsterId },
        { monsterId: goblin.id },
      ],
    },
  ],
});

const start = (fightIndex: number, encounterId = ruins.id) =>
  inTick(() => encounterStartFight(encounterId, fightIndex, 'Field Ruins'));

beforeEach(() => {
  seedContent([ruins, goblin, slime]);
  seedGamestate(
    (state) => (state.world.party = [buildCharacter({ name: 'Ada' })]),
  );
});

describe('encounterStartFight', () => {
  it('starts the requested fight within the level range, tagged for the victory handler', () => {
    start(1);

    const combat = worldCombatState();
    expect(combat).toMatchObject({
      locationName: 'Field Ruins',
      encounterId: ruins.id,
      fightIndex: 1,
    });
    expect(combat?.heroes.map((hero) => hero.name)).toEqual(['Ada']);
    expect(
      combat?.guardians.map(({ monsterId, level }) => ({ monsterId, level })),
    ).toEqual([
      { monsterId: slime.id, level: ruins.levelRange.max },
      { monsterId: goblin.id, level: ruins.levelRange.max },
    ]);
    expect(combatLog()[0].message).toContain('#2');
  });

  it("carries the node's held xp into the fight, starting empty", () => {
    start(0);
    expect(worldCombatState()?.heldXp).toEqual([]);

    inTick(() => encounterStartFight(ruins.id, 1, 'Field Ruins', [30]));
    expect(worldCombatState()?.heldXp).toEqual([30]);
  });

  it('can roll as low as the bottom of the level range', () => {
    vi.mocked(rngNumberRange).mockImplementationOnce((min) => min);

    start(0);

    expect(worldCombatState()?.guardians[0].level).toBe(ruins.levelRange.min);
  });

  it('starts nothing for an unknown encounter or a fight it does not have', () => {
    start(0, 'gone' as EncounterId);
    start(ruins.fights.length);

    expect(worldCombatState()).toBeUndefined();
  });

  it("rolls a Ranger's ambush afresh for every fight", () => {
    seedContent([
      ruins,
      goblin,
      slime,
      ...abilityJobContent('Ranger', [['Ambush', 1, 10]]),
    ]);
    seedGamestate(
      (state) =>
        (state.world.party = [
          buildAbilityHero('Ranger', 1, {}, { name: 'Rin' }),
        ]),
    );
    vi.mocked(rngSucceedsChance)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    start(0);
    expect(worldCombatState()?.ambushedBy).toBe('Rin');

    start(1);
    expect(worldCombatState()?.ambushedBy).toBeUndefined();
  });
});
