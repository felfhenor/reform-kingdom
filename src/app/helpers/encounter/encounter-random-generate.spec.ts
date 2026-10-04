import type * as RngHelper from '@helpers/rng';
import { sortBy } from 'es-toolkit/compat';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return { ...actual, rngChoiceWeighted: vi.fn(actual.rngChoiceWeighted) };
});

import { ensureEncounterRandom } from '@helpers/content/ensure-encounternode';
import { generateEncounterRandomFights } from '@helpers/encounter/encounter-random-generate';
import { rngChoiceWeighted } from '@helpers/rng';
import type {
  EncounterRandomContent,
  EncounterRandomId,
  MonsterId,
} from '@interfaces';

const slime = { monsterId: 'Slime' as MonsterId, weight: 3 };

// Fixed ranges and a single-creature pool, so every roll is decided.
const shrine = (overrides: Partial<EncounterRandomContent> = {}) =>
  ensureEncounterRandom({
    id: 'gobslime-shrine' as EncounterRandomId,
    levelRange: { min: 10, max: 20 },
    encounterRange: { min: 3, max: 3 },
    combatantRange: { min: 2, max: 6 },
    creaturePool: [slime],
    ...overrides,
  });

describe('generateEncounterRandomFights', () => {
  it('rolls the fight count within the encounter range', () => {
    expect(generateEncounterRandomFights(shrine())).toHaveLength(3);

    const counts = new Set(
      Array.from(
        { length: 40 },
        () =>
          generateEncounterRandomFights(
            shrine({ encounterRange: { min: 1, max: 2 } }),
          ).length,
      ),
    );
    expect(sortBy([...counts])).toEqual([1, 2]);
  });

  it('ramps level and combatant count from each range’s min to max across the fights', () => {
    const fights = generateEncounterRandomFights(shrine());

    expect(fights.map((fight) => fight.level)).toEqual([10, 15, 20]);
    expect(fights.map((fight) => fight.monsters.length)).toEqual([2, 4, 6]);
  });

  it('makes a lone fight the hardest of each range', () => {
    const [fight] = generateEncounterRandomFights(
      shrine({ encounterRange: { min: 1, max: 1 } }),
    );

    expect(fight.level).toBe(20);
    expect(fight.monsters).toHaveLength(6);
  });

  it('picks each monster from the pool by its weight', () => {
    const goblin = { monsterId: 'Goblin' as MonsterId, weight: 1 };
    const content = shrine({
      encounterRange: { min: 1, max: 1 },
      combatantRange: { min: 2, max: 2 },
      creaturePool: [slime],
    });

    expect(generateEncounterRandomFights(content)[0].monsters).toEqual([
      { monsterId: 'Slime' },
      { monsterId: 'Slime' },
    ]);

    generateEncounterRandomFights(shrine({ creaturePool: [goblin, slime] }));
    const [pool, weightOf] = vi.mocked(rngChoiceWeighted).mock.lastCall!;
    expect(pool).toEqual([goblin, slime]);
    expect(weightOf(slime)).toBe(3);
  });

  it('fills slots with UNKNOWN when the pool is empty', () => {
    const content = shrine({
      encounterRange: { min: 1, max: 1 },
      combatantRange: { min: 1, max: 1 },
      creaturePool: [],
    });

    expect(generateEncounterRandomFights(content)[0].monsters).toEqual([
      { monsterId: 'UNKNOWN' },
    ]);
  });
});
