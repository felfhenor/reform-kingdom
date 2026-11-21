import { ffStepNumber } from '@ff/controls/ff-number-step';
import { describe, expect, it } from 'vitest';

describe('ffStepNumber', () => {
  it('steps by the step size', () => {
    expect(ffStepNumber(5, 1, { step: 1 })).toBe(6);
    expect(ffStepNumber(5, -10, { step: 1 })).toBe(-5);
  });

  it('clamps to the bounds', () => {
    expect(ffStepNumber(98, 10, { min: 0, max: 100, step: 1 })).toBe(100);
    expect(ffStepNumber(2, -10, { min: 1, step: 1 })).toBe(1);
  });

  it('keeps fractional steps exact', () => {
    expect(ffStepNumber(0.25, 1, { min: 0, max: 1, step: 0.05 })).toBe(0.3);
    expect(ffStepNumber(0.1, 2, { min: 0, max: 1, step: 0.05 })).toBe(0.2);
  });
});
