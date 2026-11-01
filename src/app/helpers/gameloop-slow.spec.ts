import {
  GAMELOOP_SLOW_TICK_WARN_COOLDOWN_MS,
  GAMELOOP_SLOW_TICK_WARN_MS,
} from '@helpers/config';
import { warn } from '@helpers/engine/logging';
import { gameloopIsSlow, gameloopReportDuration } from '@helpers/gameloop-slow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/logging');

const slowMs = GAMELOOP_SLOW_TICK_WARN_MS;
const cooldown = GAMELOOP_SLOW_TICK_WARN_COOLDOWN_MS;

beforeEach(() => {
  vi.mocked(warn).mockClear();
});

describe('gameloopIsSlow', () => {
  it('judges a catch-up by its average tick, not its total', () => {
    expect(gameloopIsSlow(3600, 3600 * (slowMs - 1))).toBe(false);
    expect(gameloopIsSlow(1, slowMs)).toBe(true);
  });

  it('treats an empty batch as one tick', () => {
    expect(gameloopIsSlow(0, slowMs)).toBe(true);
  });
});

// Shares the module's cooldown, so each test starts well past the previous one's warnings.
describe('gameloopReportDuration', () => {
  it('ignores a fast batch', () => {
    gameloopReportDuration(1, slowMs - 1, 0);

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once per cooldown and counts the batches in between', () => {
    const start = cooldown * 10;
    gameloopReportDuration(1, slowMs, start);
    gameloopReportDuration(1, slowMs, start + 1);
    gameloopReportDuration(1, slowMs, start + 2);
    gameloopReportDuration(1, slowMs, start + cooldown);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(vi.mocked(warn).mock.calls[1][1]).toContain('3 slow batch(es)');
  });
});
