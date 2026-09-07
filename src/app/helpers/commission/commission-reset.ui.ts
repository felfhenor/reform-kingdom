import {
  mostRecentCommissionResetAt,
  ONE_DAY_MS,
} from '@helpers/commission/commission-reset';

// Used for the Commissions panel's countdown display.
export function nextCommissionResetAt(now = Date.now()): number {
  return mostRecentCommissionResetAt(now) + ONE_DAY_MS;
}
