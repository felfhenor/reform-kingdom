// Validates every commission offer is referenced by at least one caravan's or town's pool - otherwise it can never actually be rolled.

import { getEntriesByType } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CaravanContent,
  CommissionOfferContent,
  TownContent,
} from '@interfaces';

export function runCommissionUsageAnalysis(): AnalysisRunResult {
  const offers = getEntriesByType<CommissionOfferContent>('commissionoffer');
  const caravans = getEntriesByType<CaravanContent>('caravan');
  const towns = getEntriesByType<TownContent>('town');

  const usedOfferIds = new Set<string>();
  caravans.forEach((caravan) => {
    caravan.commissionOffers.forEach((slot) =>
      usedOfferIds.add(slot.commissionOfferId),
    );
  });
  towns.forEach((town) => {
    town.defense.quests.commissions.forEach((slot) =>
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
        message: `"${offer.name}" is used by at least one caravan or town.`,
      };
    }

    return {
      id,
      label: offer.name,
      status: 'fail' as const,
      message: `Commission offer "${offer.name}" (${offer.id}) isn't referenced by any caravan's commissionOffers pool or town's defense.quests.commissions pool.`,
    };
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every commission offer is used by at least one caravan or town.'
        : `${failures} commission offer(s) aren't used by any caravan or town.`,
  };
}
