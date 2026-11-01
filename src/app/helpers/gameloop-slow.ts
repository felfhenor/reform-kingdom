import {
  GAMELOOP_SLOW_TICK_WARN_COOLDOWN_MS,
  GAMELOOP_SLOW_TICK_WARN_MS,
} from '@helpers/config';
import { warn } from '@helpers/engine/logging';

let lastWarnedAt = -Infinity;
let slowBatchesSinceWarn = 0;

export function gameloopIsSlow(ticks: number, busyMs: number): boolean {
  return busyMs / Math.max(ticks, 1) >= GAMELOOP_SLOW_TICK_WARN_MS;
}

export function gameloopReportDuration(
  ticks: number,
  busyMs: number,
  now = performance.now(),
): void {
  if (!gameloopIsSlow(ticks, busyMs)) return;

  slowBatchesSinceWarn++;
  if (now - lastWarnedAt < GAMELOOP_SLOW_TICK_WARN_COOLDOWN_MS) return;

  warn(
    'Gameloop:Slow',
    `${ticks} ticks took ${Math.round(busyMs)}ms (${(busyMs / Math.max(ticks, 1)).toFixed(1)}ms/tick); ${slowBatchesSinceWarn} slow batch(es) since the last warning.`,
  );
  lastWarnedAt = now;
  slowBatchesSinceWarn = 0;
}
