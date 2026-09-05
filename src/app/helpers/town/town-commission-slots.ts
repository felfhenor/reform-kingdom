import { getEntry } from '@helpers/content/content';
import type {
  CommissionOfferContent,
  TownCommissionSlotState,
} from '@interfaces';

// Kept out of town-commission-generate.ts (which imports town-tick.ts) so town-tick.ts can pull this in without a circular import.
export function pruneInvalidTownCommissionSlots(
  slots: TownCommissionSlotState[],
): TownCommissionSlotState[] {
  return slots.filter((slot) =>
    getEntry<CommissionOfferContent>(slot.commissionOfferId),
  );
}
