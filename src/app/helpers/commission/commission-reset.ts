import { COMMISSION_RESET_HOUR_UTC, ONE_DAY_MS } from '@helpers/config';

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
