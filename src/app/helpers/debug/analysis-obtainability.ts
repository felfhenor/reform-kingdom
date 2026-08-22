/**
 * Validates that every item, collectible, and equipment entry is actually
 * obtainable in game - dropped, rewarded, gathered, crafted, traded, or
 * explicitly marked `unobtainable: true`. Ported from
 * `scripts/validate-obtainability.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CaravanTraderContent,
  CollectibleContent,
  DroppedReward,
  EncounterContent,
  EncounterRandomContent,
  EquipmentContent,
  GatheringContent,
  ItemContent,
  MonsterContent,
  RecipeContent,
} from '@interfaces';

// Content granted unconditionally by game code rather than any drop/reward/
// recipe - kept in sync by hand with `STARTER_ARMOR_NAME`/`STARTER_HAT_NAME`
// in `src/app/helpers/party.ts` and `FOUNDING_STONE_NAME` in
// `src/app/helpers/collectibles.ts`.
const GUARANTEED_GRANT_NAMES = new Set<string>([
  'Cloak of Adventuring',
  'Hat of Adventuring',
  'Founding Stone',
]);

function addIfPresent(set: Set<string>, value: string | undefined): void {
  if (value) set.add(value);
}

function collectFromDroppedRewards(
  rewards: DroppedReward[],
  itemIds: Set<string>,
  equipmentIds: Set<string>,
  collectibleIds: Set<string>,
): void {
  rewards.forEach((reward) => {
    if ('itemId' in reward) addIfPresent(itemIds, reward.itemId);
    if ('equipmentId' in reward) addIfPresent(equipmentIds, reward.equipmentId);
    if ('collectibleId' in reward) addIfPresent(collectibleIds, reward.collectibleId);
  });
}

function checkCandidates(
  kind: string,
  candidates: { id: string; name: string; unobtainable?: boolean }[],
  obtainableIds: Set<string>,
): AnalysisCheck[] {
  return candidates.map((candidate) => {
    const id = `obtainability:${kind}:${candidate.id}`;

    if (candidate.unobtainable) {
      return {
        id,
        label: candidate.name,
        status: 'info' as const,
        message: `"${candidate.name}" [${kind}] is marked unobtainable - skipped.`,
      };
    }

    if (GUARANTEED_GRANT_NAMES.has(candidate.name)) {
      return {
        id,
        label: candidate.name,
        status: 'pass' as const,
        message: `"${candidate.name}" [${kind}] is a guaranteed starting grant.`,
      };
    }

    if (obtainableIds.has(candidate.id)) {
      return {
        id,
        label: candidate.name,
        status: 'pass' as const,
        message: `"${candidate.name}" [${kind}] is obtainable.`,
      };
    }

    return {
      id,
      label: candidate.name,
      status: 'fail' as const,
      message: `${kind} "${candidate.name}" has no drop, completion reward, gather result, or recipe result that produces it, and is not marked "unobtainable: true".`,
    };
  });
}

export function runObtainabilityAnalysis(): AnalysisRunResult {
  const items = getEntriesByType<ItemContent>('item');
  const collectibles = getEntriesByType<CollectibleContent>('collectible');
  const equipment = getEntriesByType<EquipmentContent>('equipment');
  const monsters = getEntriesByType<MonsterContent>('monster');
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const encounterRandoms = getEntriesByType<EncounterRandomContent>('encounterrandom');
  const gatherings = getEntriesByType<GatheringContent>('gathering');
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const caravanTraders = getEntriesByType<CaravanTraderContent>('caravantrader');

  const obtainableItems = new Set<string>();
  const obtainableEquipment = new Set<string>();
  const obtainableCollectibles = new Set<string>();

  monsters.forEach((monster) =>
    collectFromDroppedRewards(monster.drops, obtainableItems, obtainableEquipment, obtainableCollectibles),
  );

  [...encounters, ...encounterRandoms].forEach((encounter) =>
    collectFromDroppedRewards(
      encounter.completionRewards,
      obtainableItems,
      obtainableEquipment,
      obtainableCollectibles,
    ),
  );

  gatherings.forEach((gathering) => {
    gathering.gatherResults.forEach((result) => {
      result.items.forEach((item) => addIfPresent(obtainableItems, item.itemId));
    });
  });

  recipes.forEach((recipe) => {
    const result = recipe.result;
    if ('itemId' in result) addIfPresent(obtainableItems, result.itemId);
    if ('equipmentId' in result) addIfPresent(obtainableEquipment, result.equipmentId);
    if ('collectibleId' in result) addIfPresent(obtainableCollectibles, result.collectibleId);
  });

  caravanTraders.forEach((trader) => {
    trader.trades.forEach((trade) => {
      if (trade.type !== 'sell') return;
      addIfPresent(obtainableItems, trade.itemId);
      addIfPresent(obtainableEquipment, trade.equipmentId);
      addIfPresent(obtainableCollectibles, trade.collectibleId);
    });
  });

  const checks: AnalysisCheck[] = [
    ...checkCandidates('Item', items, obtainableItems),
    ...checkCandidates('Collectible', collectibles, obtainableCollectibles),
    ...checkCandidates('Equipment', equipment, obtainableEquipment),
  ];

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every item/collectible/equipment is either obtainable or marked unobtainable.'
        : `${failures} entrie(s) have no way to be obtained.`,
  };
}
