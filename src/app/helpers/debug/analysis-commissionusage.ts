// Validates every commission offer is referenced by at least one caravan's
// commissionOffers pool - otherwise it can never actually be rolled.

import { getEntriesByType } from '@helpers/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CaravanContent,
  CommissionOfferContent,
} from '@interfaces';

export function runCommissionUsageAnalysis(): AnalysisRunResult {
  const offers = getEntriesByType<CommissionOfferContent>('commissionoffer');
  const caravans = getEntriesByType<CaravanContent>('caravan');

  const usedOfferIds = new Set<string>();
  caravans.forEach((caravan) => {
    caravan.commissionOffers.forEach((slot) =>
      usedOfferIds.add(slot.commissionOfferId),
    );
  });

  const checks: AnalysisCheck[] = offers.map((offer) => {
    const id = `commissionusage:${offer.id}`;

    if (usedOfferIds.has(offer.id)) {
      return {
        id,
        label: offer.name,
        status: 'pass' as const,
        message: `"${offer.name}" is used by at least one caravan.`,
      };
    }

    return {
      id,
      label: offer.name,
      status: 'fail' as const,
      message: `Commission offer "${offer.name}" (${offer.id}) isn't referenced by any caravan's commissionOffers pool.`,
    };
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every commission offer is used by at least one caravan.'
        : `${failures} commission offer(s) aren't used by any caravan.`,
  };
}
