import { getEntry } from '@helpers/content/content';
import type {
  CommissionOfferContent,
  TownCommissionSlotState,
} from '@interfaces';

export function pruneInvalidTownCommissionSlots(
  slots: TownCommissionSlotState[],
): TownCommissionSlotState[] {
  return slots.filter((slot) =>
    getEntry<CommissionOfferContent>(slot.commissionOfferId),
  );
}
