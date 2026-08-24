vi.mock('@helpers/hero/party', () => ({
  partyGet: vi.fn(),
}));

import {
  luckReducedChance,
  luckRollSucceeds,
  partyMaxLuck,
} from '@helpers/hero/luck';
import { partyGet } from '@helpers/hero/party';
import { rngSeeded } from '@helpers/rng';
import type { Character } from '@interfaces';
import type { PRNG } from 'seedrandom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function buildCharacter(luck: number): Character {
  return { stats: { Luck: luck } } as unknown as Character;
}

describe('luckRollSucceeds', () => {
  it('succeeds when the roll is within the luck value', () => {
    const mockRng = (() => 0.2) as PRNG; // 20%
    expect(luckRollSucceeds(25, mockRng)).toBeTruthy();
  });

  it('fails when the roll exceeds the luck value', () => {
    const mockRng = (() => 0.8) as PRNG; // 80%
    expect(luckRollSucceeds(25, mockRng)).toBeFalsy();
  });

  it('never succeeds at 0 luck', () => {
    const rng = rngSeeded('luck-test-seed');
    for (let i = 0; i < 20; i++) {
      expect(luckRollSucceeds(0, rng)).toBeFalsy();
    }
  });
});

describe('luckReducedChance', () => {
  it('reduces the base chance proportionally to luck', () => {
    expect(luckReducedChance(20, 25)).toBe(15);
  });

  it('returns the base chance unchanged at 0 luck', () => {
    expect(luckReducedChance(20, 0)).toBe(20);
  });

  it('returns 0 when luck is 100', () => {
    expect(luckReducedChance(20, 100)).toBe(0);
  });
});

describe('partyMaxLuck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the highest luck among party members', () => {
    vi.mocked(partyGet).mockReturnValue([
      buildCharacter(5),
      buildCharacter(25),
      buildCharacter(10),
    ]);

    expect(partyMaxLuck()).toBe(25);
  });

  it('defaults to 0 when the party is empty', () => {
    vi.mocked(partyGet).mockReturnValue([]);

    expect(partyMaxLuck()).toBe(0);
  });
});
