import { rangeAtLevel } from '@helpers/leveled-range';
import { describe, expect, it } from 'vitest';

describe('rangeAtLevel', () => {
  it('returns the raw range unchanged when bonusPerLevel is absent', () => {
    expect(rangeAtLevel({ min: 3, max: 10 }, 1)).toEqual({ min: 3, max: 10 });
    expect(rangeAtLevel({ min: 3, max: 10 }, 20)).toEqual({ min: 3, max: 10 });
  });

  it('adds level * bonusPerLevel to both ends of the range', () => {
    expect(rangeAtLevel({ min: 3, max: 10, bonusPerLevel: 2 }, 4)).toEqual({
      min: 11,
      max: 18,
    });
  });

  it('applies the bonus even at level 1', () => {
    expect(rangeAtLevel({ min: 3, max: 5, bonusPerLevel: 1 }, 1)).toEqual({
      min: 4,
      max: 6,
    });
  });

  it('treats an explicit bonusPerLevel of 0 the same as absent', () => {
    expect(rangeAtLevel({ min: 3, max: 10, bonusPerLevel: 0 }, 5)).toEqual({
      min: 3,
      max: 10,
    });
  });
});
