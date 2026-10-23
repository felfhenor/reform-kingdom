import { isCaravanDiscovered } from '@helpers/caravan/caravan';
import { commissionExists } from '@helpers/commission/commission-fulfill';
import { worldCommissionsState, worldTownsState } from '@helpers/state-game';
import type { CaravanId } from '@interfaces';

// Gates the Commissions tile - true once the page would list a caravan or town commission.
export function hasAnyCommission(): boolean {
  const hasCaravanCommission = (
    Object.keys(worldCommissionsState()) as CaravanId[]
  ).some((id) => isCaravanDiscovered(id) && commissionExists(id));

  return (
    hasCaravanCommission ||
    Object.values(worldTownsState()).some(
      (town) => town.commissionSlots.length > 0,
    )
  );
}
