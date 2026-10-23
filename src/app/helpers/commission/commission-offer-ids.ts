import type { CaravanContent, CommissionOfferId } from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// Content-only so the CLI analyses can share it.
export function caravanCommissionOfferIds(
  caravan: CaravanContent,
): CommissionOfferId[] {
  return uniq([
    ...caravan.commissionOffers.map((slot) => slot.commissionOfferId),
    caravan.startingCommissionOfferId,
  ]).filter((id) => id !== 'UNKNOWN');
}
