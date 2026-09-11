/**
 * Reports how "utilized" each material (item) is - how many distinct game
 * systems actually spend it - and flags materials at or below a
 * configurable threshold as under-utilized.
 */

import { getEntriesByType, getEntry } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisParams,
  AnalysisRunResult,
  AnalysisTable,
  AstralProjectorContent,
  CaravanTraderContent,
  CommissionOfferContent,
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  ItemContent,
  MaterialUtilizationStats,
  MonsterContent,
  RecipeContent,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// Resolved directly (not via `@helpers/item/materials`) since that module
// transitively imports gamestate/IndexedDB, unsafe for this ts-node script.
const TRADER_TOKEN_NAME = 'Trader Scrip';

function isInfusionMaterial(item: ItemContent): boolean {
  if (!item.infusionStats) return false;
  return Object.values(item.infusionStats).some((value) => value !== 0);
}

function emptyStats(item: ItemContent): MaterialUtilizationStats {
  return {
    name: item.name,
    rarity: item.rarity,
    unobtainable: !!item.unobtainable,
    infusable: isInfusionMaterial(item),
    craftedFrom: 0,
    craftedFromQuantity: 0,
    craftedInto: 0,
    monsterDrops: 0,
    encounterRewards: 0,
    gatherSources: 0,
    caravanBuys: 0,
    caravanSells: 0,
    astralCasts: 0,
    commissionRequirements: 0,
    commissionRewards: 0,
    traderTokenSinks: 0,
  };
}

// One point per recipe, caravan buy, astral spell, commission, and
// token-trade/unlock spend that consumes it, plus one if infusable.
function score(stats: MaterialUtilizationStats): number {
  return (
    stats.craftedFrom +
    stats.caravanBuys +
    stats.astralCasts +
    stats.commissionRequirements +
    stats.traderTokenSinks +
    (stats.infusable ? 1 : 0)
  );
}

function productionCount(stats: MaterialUtilizationStats): number {
  return (
    stats.craftedInto +
    stats.monsterDrops +
    stats.encounterRewards +
    stats.gatherSources +
    stats.caravanSells +
    stats.commissionRewards
  );
}

export function runMaterialUtilizationAnalysis(
  params: AnalysisParams,
): AnalysisRunResult {
  const expanded = !!params['expanded'];
  const threshold = Number(params['threshold'] ?? 1);
  if (!Number.isInteger(threshold) || threshold < 0) {
    throw new Error(
      `"threshold" must be a non-negative integer, got ${params['threshold']}.`,
    );
  }

  const items = getEntriesByType<ItemContent>('item');
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const monsters = getEntriesByType<MonsterContent>('monster');
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const randomEncounters =
    getEntriesByType<EncounterRandomContent>('encounterrandom');
  const gatherings = getEntriesByType<GatheringContent>('gathering');
  const caravanTraders =
    getEntriesByType<CaravanTraderContent>('caravantrader');
  const astralProjectors =
    getEntriesByType<AstralProjectorContent>('astralprojector');
  const commissionOffers =
    getEntriesByType<CommissionOfferContent>('commissionoffer');
  const traderTokenId = getEntry<ItemContent>(TRADER_TOKEN_NAME)?.id;

  const byId = new Map<string, MaterialUtilizationStats>();
  items
    .filter((item) => !item.unobtainable)
    .forEach((item) => byId.set(item.id, emptyStats(item)));

  recipes.forEach((recipe) => {
    recipe.requirements.forEach((requirement) => {
      if (!('itemId' in requirement)) return;
      const stats = byId.get(requirement.itemId);
      if (!stats) return;
      stats.craftedFrom += 1;
      stats.craftedFromQuantity += requirement.quantity ?? 0;
    });

    if ('itemId' in recipe.result) {
      const stats = byId.get(recipe.result.itemId);
      if (stats) stats.craftedInto += 1;
    }
  });

  monsters.forEach((monster) => {
    monster.drops.forEach((drop) => {
      if (!('itemId' in drop)) return;
      const stats = byId.get(drop.itemId);
      if (stats) stats.monsterDrops += 1;
    });
  });

  // `encounterrandom` (mystical/random nodes) has the same completionRewards
  // shape as `encounter` and rolls into the same encounterRewards stat.
  [...encounters, ...randomEncounters].forEach((encounter) => {
    encounter.completionRewards.forEach((reward) => {
      if (!('itemId' in reward)) return;
      const stats = byId.get(reward.itemId);
      if (stats) stats.encounterRewards += 1;
    });
  });

  gatherings.forEach((gathering) => {
    gathering.gatherResults.forEach((result) => {
      result.items.forEach((resultItem) => {
        const stats = byId.get(resultItem.itemId);
        if (stats) stats.gatherSources += 1;
      });
    });
  });

  caravanTraders.forEach((trader) => {
    trader.trades.forEach((trade) => {
      if (!trade.itemId) return;
      const stats = byId.get(trade.itemId);
      if (!stats) return;
      if (trade.type === 'buy') stats.caravanBuys += 1;
      if (trade.type === 'sell') stats.caravanSells += 1;
    });

    // Token trades are always paid for in Trader Scrip, not `trade.itemId`.
    if (traderTokenId && trader.tokenTrades.length > 0) {
      const stats = byId.get(traderTokenId);
      if (stats) stats.traderTokenSinks += trader.tokenTrades.length;
    }
  });

  astralProjectors.forEach((astralProjector) => {
    astralProjector.requiredMaterials.forEach((requirement) => {
      const stats = byId.get(requirement.itemId);
      if (stats) stats.astralCasts += 1;
    });
  });

  commissionOffers.forEach((offer) => {
    offer.requirements.forEach((requirement) => {
      if (!('itemId' in requirement)) return;
      const stats = byId.get(requirement.itemId);
      if (stats) stats.commissionRequirements += 1;
    });

    offer.rewards.forEach((reward) => {
      if (!('itemId' in reward)) return;
      const stats = byId.get(reward.itemId);
      if (stats) stats.commissionRewards += 1;
    });
  });

  // Museum recipe unlocks are also always paid for in Trader Scrip.
  if (traderTokenId) {
    const stats = byId.get(traderTokenId);
    if (stats) {
      stats.traderTokenSinks += recipes.filter(
        (recipe) => recipe.tokenUnlockCost > 0,
      ).length;
    }
  }

  const allStats = sortBy(
    [...byId.values()],
    [
      (stats: MaterialUtilizationStats) => score(stats),
      (stats: MaterialUtilizationStats) => stats.name,
    ],
  );

  const rows: Record<string, string | number>[] = allStats.map(
    (stats): Record<string, string | number> =>
      expanded
        ? {
            Material: stats.name,
            Rarity: stats.rarity,
            Score: score(stats),
            'Crafted From (recipes)': stats.craftedFrom,
            'Crafted From (qty)': stats.craftedFromQuantity,
            Infusable: stats.infusable ? 'Yes' : 'No',
            'Caravan Buys': stats.caravanBuys,
            'Astral Casts': stats.astralCasts,
            'Commission Requirements': stats.commissionRequirements,
            'Trader Token Sinks': stats.traderTokenSinks,
            'Crafted Into': stats.craftedInto,
            'Monster Drops': stats.monsterDrops,
            'Encounter Rewards': stats.encounterRewards,
            'Gather Sources': stats.gatherSources,
            'Caravan Sells': stats.caravanSells,
            'Commission Rewards': stats.commissionRewards,
            Production: productionCount(stats),
          }
        : { Material: stats.name, Rarity: stats.rarity, Score: score(stats) },
  );

  const table: AnalysisTable = {
    title: 'Material utilization',
    columns: rows[0] ? Object.keys(rows[0]) : ['Material', 'Rarity', 'Score'],
    rows,
  };

  const underUtilized = allStats.filter(
    (stats) => !stats.unobtainable && score(stats) <= threshold,
  );

  const checks: AnalysisCheck[] = underUtilized.map((stats) => {
    const sinks: string[] = [];
    if (stats.craftedFrom > 0) sinks.push(`${stats.craftedFrom} recipe(s)`);
    if (stats.caravanBuys > 0)
      sinks.push(`${stats.caravanBuys} caravan buy(s)`);
    if (stats.astralCasts > 0)
      sinks.push(`${stats.astralCasts} astral spell(s)`);
    if (stats.commissionRequirements > 0)
      sinks.push(`${stats.commissionRequirements} commission(s)`);
    if (stats.traderTokenSinks > 0)
      sinks.push(`${stats.traderTokenSinks} token trade/unlock(s)`);
    if (stats.infusable) sinks.push('infusable');
    const sinkDescription =
      sinks.length > 0 ? sinks.join(', ') : 'no known sinks';
    const sources = productionCount(stats);

    return {
      id: `under-utilized:${stats.name}`,
      label: stats.name,
      status: 'warning' as const,
      message: `${stats.name} [${stats.rarity}]: score=${score(stats)} (${sinkDescription}), ${sources} production source(s).`,
    };
  });

  return {
    checks,
    tables: [table],
    summary:
      underUtilized.length === 0
        ? 'Every obtainable material clears the threshold.'
        : `${underUtilized.length} of ${allStats.length} obtainable material(s) are under-utilized (score <= ${threshold}).`,
  };
}
