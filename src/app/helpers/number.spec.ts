import { describe, expect, it } from 'vitest';
import { roundToNearest10 } from '@helpers/number';

describe('roundToNearest10', () => {
  it('rounds down when closer to the lower multiple of 10', () => {
    expect(roundToNearest10(24)).toBe(20);
  });

  it('rounds up when closer to the upper multiple of 10', () => {
    expect(roundToNearest10(26)).toBe(30);
  });

  it('rounds a midpoint value up', () => {
    expect(roundToNearest10(25)).toBe(30);
  });

  it('leaves an exact multiple of 10 unchanged', () => {
    expect(roundToNearest10(40)).toBe(40);
  });
});
