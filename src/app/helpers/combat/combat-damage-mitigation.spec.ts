import {
  combatDamageMitigationExpectedValue,
  combatDamageMitigationRoll,
} from '@helpers/combat/combat-damage-mitigation';
import type * as RngHelper from '@helpers/rng';
import { rngUniform } from '@helpers/rng';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return { ...actual, rngUniform: vi.fn() };
});

describe('combatDamageMitigationRoll', () => {
  it('returns the full ceiling when the roll is 1', () => {
    vi.mocked(rngUniform).mockReturnValue(1);

    expect(combatDamageMitigationRoll(100, 0)).toBe(100);
  });

  it('returns 0 when the roll is 0', () => {
    vi.mocked(rngUniform).mockReturnValue(0);

    expect(combatDamageMitigationRoll(100, 0)).toBe(0);
  });

  it('skews toward the ceiling using U^(1/n) at 0 Luck (n=2)', () => {
    vi.mocked(rngUniform).mockReturnValue(0.25);

    expect(combatDamageMitigationRoll(100, 0)).toBeCloseTo(100 * 0.25 ** 0.5);
  });

  it('increases the result for the same roll as Luck rises', () => {
    vi.mocked(rngUniform).mockReturnValue(0.25);

    const lowLuck = combatDamageMitigationRoll(100, 0);
    const highLuck = combatDamageMitigationRoll(100, 100);

    expect(highLuck).toBeGreaterThan(lowLuck);
  });

  it('never rolls below 0 even with negative Luck', () => {
    vi.mocked(rngUniform).mockReturnValue(0);

    expect(combatDamageMitigationRoll(100, -1000)).toBe(0);
  });

  it('never exceeds the ceiling even with negative Luck', () => {
    vi.mocked(rngUniform).mockReturnValue(1);

    expect(combatDamageMitigationRoll(100, -1000)).toBe(100);
  });
});

describe('combatDamageMitigationExpectedValue', () => {
  it('is 2/3 of the ceiling at 0 Luck (n=2)', () => {
    expect(combatDamageMitigationExpectedValue(90, 0)).toBeCloseTo(60);
  });

  it('is 3/4 of the ceiling at 10 Luck (n=3)', () => {
    expect(combatDamageMitigationExpectedValue(80, 10)).toBeCloseTo(60);
  });

  it('approaches but never reaches the ceiling as Luck grows', () => {
    const expected = combatDamageMitigationExpectedValue(100, 1000);

    expect(expected).toBeLessThan(100);
    expect(expected).toBeGreaterThan(95);
  });

  it('is monotonically increasing in Luck', () => {
    const lowLuck = combatDamageMitigationExpectedValue(100, 0);
    const highLuck = combatDamageMitigationExpectedValue(100, 50);

    expect(highLuck).toBeGreaterThan(lowLuck);
  });
});
