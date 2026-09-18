// Validates every item a town's assigned commissions ask for has a corresponding materialThresholds entry for that
// town - otherwise the gathering/commission priority system has no cap to check against. Also validates each
// threshold entry's sale config: a material opted into sale (value > 0) must have a sellAtQuantity that's both
// non-negative and strictly below maxQuantity, or it could never actually surface as sellable "excess".

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

function missingThresholdMessage(town: TownContent, missing: ItemId[]): string {
  const missingNames = missing
    .map((itemId) => getEntry<ItemContent>(itemId)?.name ?? itemId)
    .join(', ');
  return `Town "${town.name}" (${town.id}) has commissions requesting items with no material threshold: ${missingNames}.`;
}

function saleThresholdMessages(town: TownContent): string[] {
  return town.materialThresholds
    .filter((threshold) => threshold.value > 0)
    .filter(
      (threshold) =>
        threshold.sellAtQuantity < 0 ||
        threshold.sellAtQuantity >= threshold.maxQuantity,
    )
    .map((threshold) => {
      const name =
        getEntry<ItemContent>(threshold.itemId)?.name ?? threshold.itemId;
      return `Town "${town.name}" (${town.id}) sells "${name}" but its sellAtQuantity (${threshold.sellAtQuantity}) is not a non-negative value below its maxQuantity (${threshold.maxQuantity}).`;
    });
}

export function runTownMaterialThresholdsAnalysis(): AnalysisRunResult {
  const towns = getEntriesByType<TownContent>('town');
  const checks: AnalysisCheck[] = [];

  towns.forEach((town) => {
    const thresholdItemIds = new Set(
      town.materialThresholds.map((threshold) => threshold.itemId),
    );
    const missing = [...commissionItemIdsForTown(town)].filter(
      (itemId) => !thresholdItemIds.has(itemId),
    );
    const saleIssues = saleThresholdMessages(town);

    const id = `townmaterialthresholds:${town.id}`;
    if (missing.length === 0 && saleIssues.length === 0) {
      checks.push({
        id,
        label: town.name,
        status: 'pass',
        message: `"${town.name}" has a material threshold defined for every item its commissions request, and every sellable material's sellAtQuantity is valid.`,
      });
      return;
    }

    const messages = [
      ...(missing.length > 0 ? [missingThresholdMessage(town, missing)] : []),
      ...saleIssues,
    ];
    checks.push({
      id,
      label: town.name,
      status: 'fail',
      message: messages.join(' '),
    });
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every town has a material threshold defined for every item its commissions request, and every sellable material has a valid sellAtQuantity.'
        : `${failures} town(s) have a material-threshold problem (missing commission coverage and/or an invalid sale threshold).`,
  };
}
