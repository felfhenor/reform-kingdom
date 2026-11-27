import { describe, expect, it } from 'vitest';
import {
  workerAssignmentAfterUnit,
  workerOrderCount,
} from '@helpers/worker/worker-order';
import type { RecipeId } from '@interfaces';

const recipeId = 'recipe' as RecipeId;

describe('workerOrderCount', () => {
  it('keeps positive counts, flooring fractions', () => {
    expect(workerOrderCount(5)).toBe(5);
    expect(workerOrderCount(2.7)).toBe(2);
  });

  it('treats blank, zero, negative and NaN as unlimited', () => {
    [undefined, 0, -3, 0.5, NaN, Infinity].forEach((value) =>
      expect(workerOrderCount(value)).toBeUndefined(),
    );
  });
});

describe('workerAssignmentAfterUnit', () => {
  it('passes unlimited orders and null through by reference', () => {
    const assignment = { recipeId };
    expect(workerAssignmentAfterUnit(assignment)).toBe(assignment);
    expect(workerAssignmentAfterUnit(null)).toBeNull();
  });

  it('counts down, then clears on the last unit', () => {
    expect(workerAssignmentAfterUnit({ recipeId, remaining: 3 })).toEqual({
      recipeId,
      remaining: 2,
    });
    expect(workerAssignmentAfterUnit({ recipeId, remaining: 1 })).toBeNull();
  });
});
