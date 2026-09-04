import { riskBandForLevelRange } from '@helpers/engine/risk-band';
import { describe, expect, it } from 'vitest';

describe('riskBandForLevelRange', () => {
  it('is Low when the range is at or below the party level', () => {
    expect(riskBandForLevelRange({ min: 5, max: 10 }, 10)).toBe('Low');
  });

  it('is Medium when the party can clear the floor but not the ceiling', () => {
    expect(riskBandForLevelRange({ min: 8, max: 12 }, 10)).toBe('Medium');
  });

  it('is High when the floor itself is above the party, within the hard cap', () => {
    expect(riskBandForLevelRange({ min: 16, max: 18 }, 10)).toBe('High');
  });

  it('is TooHigh beyond 7 levels above the party', () => {
    expect(riskBandForLevelRange({ min: 18, max: 20 }, 10)).toBe('TooHigh');
  });

  it('is exactly TooHigh at the 8-level boundary and High at 7', () => {
    expect(riskBandForLevelRange({ min: 17, max: 17 }, 10)).toBe('High');
    expect(riskBandForLevelRange({ min: 18, max: 18 }, 10)).toBe('TooHigh');
  });
});
