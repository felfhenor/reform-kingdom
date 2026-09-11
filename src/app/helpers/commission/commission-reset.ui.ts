import { mostRecentCommissionResetAt } from '@helpers/commission/commission-reset';
import { ONE_DAY_MS } from '@helpers/config';

// Used for the Commissions panel's countdown display.
export function nextCommissionResetAt(now = Date.now()): number {
  return mostRecentCommissionResetAt(now) + ONE_DAY_MS;
}
