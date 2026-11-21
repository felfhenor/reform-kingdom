import { describe, expect, it } from 'vitest';

import { percentOf } from '@helpers/math';

describe('percentOf', () => {
  it('takes the percent of a value, rounded down', () => {
    expect(percentOf(10, 50)).toBe(5);
    expect(percentOf(7, 50)).toBe(3);
    expect(percentOf(1, 50)).toBe(0);
  });

  it('clamps the percent to 0-100', () => {
    expect(percentOf(10, 150)).toBe(10);
    expect(percentOf(10, -20)).toBe(0);
  });
});
