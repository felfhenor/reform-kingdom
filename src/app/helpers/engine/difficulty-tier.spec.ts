import {
  exploreDifficultyTier,
  gatherDifficultyTier,
} from '@helpers/engine/difficulty-tier';
import { OVERLEVEL_XP_HARD_CAP_LEVELS } from '@helpers/config';
import { describe, expect, it } from 'vitest';

describe('exploreDifficultyTier', () => {
  const range = { min: 10, max: 12 };

  it.each([
    [2, 'TooHigh'],
    [3, 'Hard'],
    [10, 'Medium'],
    [12, 'Easy'],
    [12 + OVERLEVEL_XP_HARD_CAP_LEVELS - 1, 'Easy'],
    [12 + OVERLEVEL_XP_HARD_CAP_LEVELS, 'Trivial'],
  ])('at party level %i is %s', (level, tier) => {
    expect(exploreDifficultyTier(range, level)).toBe(tier);
  });
});

describe('gatherDifficultyTier', () => {
  const range = { min: 10, max: 12 };

  it.each([
    [9, 'TooHigh'],
    [10, 'Medium'],
    [11, 'Medium'],
    [12, 'Easy'],
    [13, 'Trivial'],
  ])('at level %i is %s', (level, tier) => {
    expect(gatherDifficultyTier(range, level)).toBe(tier);
  });
});
