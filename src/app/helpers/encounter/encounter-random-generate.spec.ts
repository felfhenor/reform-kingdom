import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', () => ({
  rngChoiceWeighted: vi.fn(),
  rngNumberRange: vi.fn(),
}));

import { generateEncounterRandomFights } from '@helpers/encounter/encounter-random-generate';
import { rngChoiceWeighted, rngNumberRange } from '@helpers/rng';
import type { EncounterRandomContent } from '@interfaces';

function buildContent(
  overrides: Partial<EncounterRandomContent> = {},
): EncounterRandomContent {
  return {
    id: 'gobslime-shrine',
    name: 'Mystical Gobslime Shrine',
    __type: 'encounterrandom',
    description: 'A shrine.',
    resetTime: 3600,
    levelRange: { min: 10, max: 20 },
    encounterRange: { min: 3, max: 3 },
    combatantRange: { min: 2, max: 6 },
    creaturePool: [
      { monsterId: 'Goblin', weight: 1 },
      { monsterId: 'Slime', weight: 3 },
    ],
    fights: [],
    completionRewards: [],
    ...overrides,
  } as unknown as EncounterRandomContent;
}

describe('generateEncounterRandomFights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a fight count from rngNumberRange bounded by encounterRange', () => {
    vi.mocked(rngNumberRange).mockReturnValue(3);
    vi.mocked(rngChoiceWeighted).mockReturnValue({
      monsterId: 'Slime',
      weight: 3,
    } as never);

    const content = buildContent();
    const fights = generateEncounterRandomFights(content);

    expect(fights).toHaveLength(3);
    expect(rngNumberRange).toHaveBeenCalledWith(
      content.encounterRange.min,
      content.encounterRange.max + 1,
    );
  });

  it('trends level and combatant count from levelRange.min/combatantRange.min up to .max across the sequence', () => {
    vi.mocked(rngNumberRange).mockReturnValue(3);
    vi.mocked(rngChoiceWeighted).mockReturnValue({
      monsterId: 'Slime',
      weight: 3,
    } as never);

    const fights = generateEncounterRandomFights(buildContent());

    expect(fights.map((f) => f.level)).toEqual([10, 15, 20]);
    expect(fights.map((f) => f.monsters.length)).toEqual([2, 4, 6]);
  });

  it('rolls each monster slot via rngChoiceWeighted using pool weight', () => {
    vi.mocked(rngNumberRange).mockReturnValue(1);
    const pool = buildContent().creaturePool;
    vi.mocked(rngChoiceWeighted).mockReturnValue(pool[1] as never);

    const content = buildContent({
      encounterRange: { min: 1, max: 1 },
      combatantRange: { min: 2, max: 2 },
    });
    const fights = generateEncounterRandomFights(content);

    expect(fights[0].monsters).toEqual([
      { monsterId: 'Slime' },
      { monsterId: 'Slime' },
    ]);

    const [items, weightFn] = vi.mocked(rngChoiceWeighted).mock.calls[0];
    expect(items).toBe(content.creaturePool);
    expect(weightFn(pool[1])).toBe(3);
  });

  it('falls back to UNKNOWN when the pool is empty', () => {
    vi.mocked(rngNumberRange).mockReturnValue(1);
    vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);

    const content = buildContent({
      encounterRange: { min: 1, max: 1 },
      combatantRange: { min: 1, max: 1 },
      creaturePool: [],
    });
    const fights = generateEncounterRandomFights(content);

    expect(fights[0].monsters).toEqual([{ monsterId: 'UNKNOWN' }]);
  });
});
