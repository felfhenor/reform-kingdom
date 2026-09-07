import { gamestate } from '@helpers/state-game';

// Gates the Commissions tile - true once any caravan has a live commission.
export function hasAnyCommission(): boolean {
  return Object.keys(gamestate().world.commissions).length > 0;
}
