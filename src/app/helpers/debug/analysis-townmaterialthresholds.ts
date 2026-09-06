// Validates every item a town's assigned commissions ask for has a corresponding materialThresholds entry for that town - otherwise the gathering/commission priority system has no cap to check against.

import { getEntriesByType, getEntry } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CommissionOfferContent,
  ItemContent,
  ItemId,
  TownContent,
} from '@interfaces';

function commissionItemIdsForTown(town: TownContent): Set<ItemId> {
  const itemIds = new Set<ItemId>();

  town.defense.quests.commissions.forEach((slot) => {
    const offer = getEntry<CommissionOfferContent>(slot.commissionOfferId);
    offer?.requirements.forEach((requirement) => {
      if ('itemId' in requirement) itemIds.add(requirement.itemId);
    });
  });

  return itemIds;
}

export function runTownMaterialThresholdsAnalysis(): AnalysisRunResult {
  const towns = getEntriesByType<TownContent>('town');
  const checks: AnalysisCheck[] = [];

  towns.forEach((town) => {
    const thresholdItemIds = new Set(
      town.gathering.materialThresholds.map((threshold) => threshold.itemId),
    );
    const missing = [...commissionItemIdsForTown(town)].filter(
      (itemId) => !thresholdItemIds.has(itemId),
    );

    const id = `townmaterialthresholds:${town.id}`;
    if (missing.length === 0) {
      checks.push({
        id,
        label: town.name,
        status: 'pass',
        message: `"${town.name}" has a material threshold defined for every item its commissions request.`,
      });
      return;
    }

    const missingNames = missing
      .map((itemId) => getEntry<ItemContent>(itemId)?.name ?? itemId)
      .join(', ');
    checks.push({
      id,
      label: town.name,
      status: 'fail',
      message: `Town "${town.name}" (${town.id}) has commissions requesting items with no material threshold: ${missingNames}.`,
    });
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every town has a material threshold defined for every item its commissions request.'
        : `${failures} town(s) have commissions requesting items with no material threshold defined.`,
  };
}
