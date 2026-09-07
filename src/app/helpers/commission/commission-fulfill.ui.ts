import { isPartyAtCaravan } from '@helpers/caravan/caravan';
import {
  commissionCanFulfill,
  commissionExists,
  commissionRequirementEntries,
  commissionRewards,
  commissionState,
} from '@helpers/commission/commission-fulfill';
import { canPartyTravel, travelEtaSecondsTo } from '@helpers/hero/travel';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type { CommissionRowViewModel, WorldNodeEntry } from '@interfaces';

// Built once here so the Commissions panel and a caravan's trade modal
// turn-in section render identically without duplicating this composition.
export function commissionRowViewModel(
  entry: WorldNodeEntry,
): CommissionRowViewModel | undefined {
  const caravan = worldNodeCaravan(entry);
  if (!caravan || !commissionExists(caravan.id)) return undefined;

  return {
    caravanId: caravan.id,
    nodeName: entry.nodeName,
    title: caravan.name,
    requirementEntries: commissionRequirementEntries(caravan.id),
    rewards: commissionRewards(caravan.id),
    canFulfill: commissionCanFulfill(caravan.id),
    completed: !!commissionState(caravan.id)?.completed,
    isPartyHere: isPartyAtCaravan(caravan.id),
    canTravel: canPartyTravel(),
    travelEtaSeconds: travelEtaSecondsTo(entry.nodeName),
  };
}
