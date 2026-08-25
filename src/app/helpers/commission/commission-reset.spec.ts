import {
  mostRecentCommissionResetAt,
  nextCommissionResetAt,
} from '@helpers/commission/commission-reset';
import { describe, expect, it } from 'vitest';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BOUNDARY = Date.UTC(2024, 0, 15, 9, 0, 0); // 3AM UTC-6 = 9AM UTC, Jan 15 2024

describe('mostRecentCommissionResetAt', () => {
  it('returns today\'s boundary when now is after it', () => {
    const now = BOUNDARY + 60 * 60 * 1000; // 1 hour after
    expect(mostRecentCommissionResetAt(now)).toBe(BOUNDARY);
  });

  it('returns today\'s boundary when now is exactly at it', () => {
    expect(mostRecentCommissionResetAt(BOUNDARY)).toBe(BOUNDARY);
  });

  it("returns yesterday's boundary when now is before today's", () => {
    const now = BOUNDARY - 60 * 60 * 1000; // 1 hour before
    expect(mostRecentCommissionResetAt(now)).toBe(BOUNDARY - ONE_DAY_MS);
  });
});

describe('nextCommissionResetAt', () => {
  it('is exactly one day after the most recent boundary', () => {
    const now = BOUNDARY + 60 * 60 * 1000;
    expect(nextCommissionResetAt(now)).toBe(BOUNDARY + ONE_DAY_MS);
  });
});
