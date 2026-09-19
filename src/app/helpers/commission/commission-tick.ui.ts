import { worldCommissionsState } from '@helpers/state-game';

// Gates the Commissions tile - true once any caravan has a live commission.
export function hasAnyCommission(): boolean {
  return Object.keys(worldCommissionsState()).length > 0;
}
