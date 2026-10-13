import { luckReducedChance, luckRollSucceeds } from '@helpers/hero/luck';
import { rngSeeded } from '@helpers/rng';
import type { PRNG } from 'seedrandom';
import { describe, expect, it } from 'vitest';

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
