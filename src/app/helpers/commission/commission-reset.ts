// Fixed UTC-6 offset year-round (no DST handling, by design) - "3AM CST" as
// a wall-clock reset boundary.
const COMMISSION_RESET_HOUR_UTC = 9;
// Exported so commission-reset.ui.ts's countdown helper can share this constant.
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// The most recent 3AM (UTC-6) boundary at or before `now`.
export function mostRecentCommissionResetAt(now = Date.now()): number {
  const date = new Date(now);
  const boundary = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    COMMISSION_RESET_HOUR_UTC,
  );

  return boundary <= now ? boundary : boundary - ONE_DAY_MS;
}
