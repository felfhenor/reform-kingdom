import type { CommissionOfferId, CommissionOfferSlot } from '../../interfaces';

export function ensureCommissionOfferSlot(
  slot: Partial<CommissionOfferSlot> = {},
): CommissionOfferSlot {
  return {
    commissionOfferId:
      slot.commissionOfferId ?? ('UNKNOWN' as CommissionOfferId),
    weight: slot.weight ?? 1,
  };
}
