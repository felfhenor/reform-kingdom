import { describe, expect, it } from 'vitest';

import { formatDuration } from '@helpers/timer';

describe('formatDuration', () => {
  it('formats ticks as HH:MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(65)).toBe('00:01:05');
    expect(formatDuration(3661)).toBe('01:01:01');
  });
});
