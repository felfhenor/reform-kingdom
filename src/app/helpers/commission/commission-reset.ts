// Fixed UTC-6 offset year-round (no DST handling, by design) - "3AM CST" as
// a wall-clock reset boundary, not a tick-elapsed timer like
// CaravanContent.traderResetTime. See CommissionNodeState.generatedAt.
const COMMISSION_RESET_HOUR_UTC = 9;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

// Used for the Commissions panel's countdown display.
export function nextCommissionResetAt(now = Date.now()): number {
  return mostRecentCommissionResetAt(now) + ONE_DAY_MS;
}
