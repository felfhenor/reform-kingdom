import { describe, expect, it } from 'vitest';

import { formatDuration } from '@helpers/timer';

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
