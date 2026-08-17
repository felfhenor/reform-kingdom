import { describe, expect, it } from 'vitest';

import { formatDuration, ticksToDurationParts } from '@helpers/timer';

describe('formatDuration', () => {
  it('formats ticks under an hour as MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('formats ticks at or above an hour as HH:MM:SS', () => {
    expect(formatDuration(3600)).toBe('01:00:00');
    expect(formatDuration(3661)).toBe('01:01:01');
  });
});

describe('ticksToDurationParts', () => {
  it('returns a single zero-second part when there are no ticks', () => {
    expect(ticksToDurationParts(0)).toEqual([{ value: 0, unit: 'second' }]);
  });

  it('omits zero-value units', () => {
    expect(ticksToDurationParts(65)).toEqual([
      { value: 1, unit: 'minute' },
      { value: 5, unit: 'second' },
    ]);
  });

  it('includes days, hours, minutes, and seconds when all are present', () => {
    const ticks = 1 * 86400 + 2 * 3600 + 3 * 60 + 4;
    expect(ticksToDurationParts(ticks)).toEqual([
      { value: 1, unit: 'day' },
      { value: 2, unit: 'hour' },
      { value: 3, unit: 'minute' },
      { value: 4, unit: 'second' },
    ]);
  });

  it('floors negative ticks to zero', () => {
    expect(ticksToDurationParts(-100)).toEqual([{ value: 0, unit: 'second' }]);
  });
});
