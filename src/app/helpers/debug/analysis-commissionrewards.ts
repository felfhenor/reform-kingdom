// Validates every commission offer has the reward(s) required by whichever pool(s) actually reference it - a caravan needs `rewards`, a town needs `townReputationReward`, and some offers are assigned to both.

import { getEntriesByType } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CaravanContent,
  CommissionOfferContent,
  TownContent,
} from '@interfaces';

export function runCommissionRewardsAnalysis(): AnalysisRunResult {
  const offers = getEntriesByType<CommissionOfferContent>('commissionoffer');
  const caravans = getEntriesByType<CaravanContent>('caravan');
  const towns = getEntriesByType<TownContent>('town');

  const caravanOfferIds = new Set<string>();
  caravans.forEach((caravan) =>
    caravan.commissionOffers.forEach((slot) =>
      caravanOfferIds.add(slot.commissionOfferId),
    ),
  );

  const townOfferIds = new Set<string>();
  towns.forEach((town) =>
    town.defense.quests.commissions.forEach((slot) =>
      townOfferIds.add(slot.commissionOfferId),
    ),
  );

  const checks: AnalysisCheck[] = [];

  offers.forEach((offer) => {
    const usedByCaravan = caravanOfferIds.has(offer.id);
    const usedByTown = townOfferIds.has(offer.id);
    if (!usedByCaravan && !usedByTown) return;

    const missing: string[] = [];
    if (usedByCaravan && offer.rewards.length === 0) {
      missing.push('normal rewards (used by a caravan)');
    }
    if (usedByTown && offer.townReputationReward <= 0) {
      missing.push('a town reputation reward (used by a town)');
    }

    const id = `commissionrewards:${offer.id}`;
    if (missing.length === 0) {
      checks.push({
        id,
        label: offer.name,
        status: 'pass',
        message: `"${offer.name}" has the reward(s) required by the pool(s) it's assigned to.`,
      });
      return;
    }

    checks.push({
      id,
      label: offer.name,
      status: 'fail',
      message: `Commission offer "${offer.name}" (${offer.id}) is missing ${missing.join(' and ')}.`,
    });
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every used commission offer has the reward(s) its assigned pool(s) require.'
        : `${failures} commission offer(s) are missing a reward their assigned pool needs.`,
  };
}
