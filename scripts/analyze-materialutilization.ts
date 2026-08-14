/**
 * Reports how "utilized" each material (item) is - how many distinct
 * game systems actually spend it - and flags materials that fall at or
 * below a configurable utilization threshold as under-utilized.
 *
 * Utilization counts every *consumption* channel a material can be spent
 * through:
 *   - crafting: a recipe requirement (`RecipeContent.requirements[].itemId`)
 *   - infusion: the item has non-zero `infusionStats`, mirroring
 *     `isInfusionMaterial` in `src/app/helpers/infusion.ts` - any equipment
 *     slot can consume it
 *   - caravan trading: a caravan trader `buy`s it from the party
 *     (`gamedata/caravantrader/*.yml` `trades[].type === 'buy'`) - a gold
 *     sink for the material, same as a recipe consuming it
 *
 * Production (how many ways a material can be obtained - monster drops,
 * encounter completion rewards, gathering nodes, recipe results, and now a
 * caravan trader `sell`ing it) is reported alongside for context, since a
 * material with many supply sources but no sinks is the clearest sign of
 * under-utilized content - but it does not count toward the utilization
 * score itself.
 *
 * Runs against raw `gamedata/**\/*.yml` sources (matching by the authored
 * `name` field, same as `validate-obtainability.ts`), so it needs no build
 * step first.
 *
 * The default table is just Name/Rarity/Score/Unobtainable, sorted least-
 * used first, so it fits an average console. Pass `--expanded` for the
 * full per-source breakdown (crafted from/into, infusable, drops, etc).
 *
 * Usage: ts-node scripts/analyze-materialutilization [--expanded] [threshold=1]
 * Materials with a score <= threshold are listed as under-utilized in the
 * summary.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import * as yaml from 'js-yaml';
import rec from 'recursive-readdir';

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMEDATA_DIR = path.join(ROOT_DIR, 'gamedata');

async function loadContentType(folder: string): Promise<any[]> {
  const dir = path.join(GAMEDATA_DIR, folder);
  if (!fs.existsSync(dir)) return [];

  const files: string[] = (await rec(dir)).filter((file: string) =>
    file.endsWith('.yml'),
  );

  const entries: any[] = [];
  files.forEach((file: string) => {
    const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as any[] | undefined;
    entries.push(...(doc ?? []));
  });
  return entries;
}

function isInfusionMaterial(item: any): boolean {
  if (!item.infusionStats) return false;
  return Object.values(item.infusionStats).some((value) => value !== 0);
}

type MaterialStats = {
  name: string;
  rarity: string;
  unobtainable: boolean;
  infusable: boolean;
  craftedFrom: number;
  craftedFromQuantity: number;
  craftedInto: number;
  monsterDrops: number;
  encounterRewards: number;
  gatherSources: number;
  caravanBuys: number;
  caravanSells: number;
};

function emptyStats(item: any): MaterialStats {
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
  };
}

// The general-purpose "how many uses does this item have" number - one per
// recipe that requires it, one per caravan trader willing to buy it (a gold
// sink), plus one more if it's infusable (any equipment slot is a valid
// sink for it).
function score(stats: MaterialStats): number {
  return (
    stats.craftedFrom + stats.caravanBuys + (stats.infusable ? 1 : 0)
  );
}

function productionCount(stats: MaterialStats): number {
  return (
    stats.craftedInto +
    stats.monsterDrops +
    stats.encounterRewards +
    stats.gatherSources +
    stats.caravanSells
  );
}

function countDroppedRewards(
  rewards: any[] | undefined,
  byName: Map<string, MaterialStats>,
  key: 'monsterDrops' | 'encounterRewards',
): void {
  (rewards ?? []).forEach((reward) => {
    const stats = byName.get(reward.itemId);
    if (!stats) return;
    stats[key] += 1;
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const expanded = args.includes('--expanded');
  const thresholdArg = args.find((arg) => arg !== '--expanded');

  const threshold = thresholdArg !== undefined ? Number(thresholdArg) : 1;
  if (!Number.isInteger(threshold) || threshold < 0) {
    console.error(
      'Usage: ts-node scripts/analyze-materialutilization [--expanded] [threshold=1]',
    );
    process.exit(1);
  }

  console.log('=== analyze:materialutilization ===\n');

  const [items, recipes, monsters, encounters, gatherings, caravanTraders] =
    await Promise.all([
      loadContentType('item'),
      loadContentType('recipe'),
      loadContentType('monster'),
      loadContentType('encounter'),
      loadContentType('gathering'),
      loadContentType('caravantrader'),
    ]);

  const byName = new Map<string, MaterialStats>();
  items
    .filter((item) => !item.unobtainable)
    .forEach((item) => byName.set(item.name, emptyStats(item)));

  recipes.forEach((recipe) => {
    (recipe.requirements ?? []).forEach((requirement: any) => {
      if (!requirement.itemId) return;
      const stats = byName.get(requirement.itemId);
      if (!stats) return;
      stats.craftedFrom += 1;
      stats.craftedFromQuantity += requirement.quantity ?? 0;
    });

    const result = recipe.result ?? {};
    if (result.itemId) {
      const stats = byName.get(result.itemId);
      if (stats) stats.craftedInto += 1;
    }
  });

  monsters.forEach((monster) =>
    countDroppedRewards(monster.drops, byName, 'monsterDrops'),
  );
  encounters.forEach((encounter) =>
    countDroppedRewards(
      encounter.completionRewards,
      byName,
      'encounterRewards',
    ),
  );

  gatherings.forEach((gathering) => {
    (gathering.gatherResults ?? []).forEach((result: any) => {
      (result.items ?? []).forEach((resultItem: any) => {
        const stats = byName.get(resultItem.itemId);
        if (!stats) return;
        stats.gatherSources += 1;
      });
    });
  });

  caravanTraders.forEach((trader) => {
    (trader.trades ?? []).forEach((trade: any) => {
      if (!trade.itemId) return;
      const stats = byName.get(trade.itemId);
      if (!stats) return;
      if (trade.type === 'buy') stats.caravanBuys += 1;
      if (trade.type === 'sell') stats.caravanSells += 1;
    });
  });

  const allStats = [...byName.values()].sort((a, b) => {
    const scoreDiff = score(a) - score(b);
    if (scoreDiff !== 0) return scoreDiff;
    return a.name.localeCompare(b.name);
  });

  const table: Record<string, Record<string, number | string>> = {};
  allStats.forEach((stats) => {
    table[stats.name] = expanded
      ? {
          Rarity: stats.rarity,
          Score: score(stats),
          'Crafted From (recipes)': stats.craftedFrom,
          'Crafted From (qty)': stats.craftedFromQuantity,
          Infusable: stats.infusable ? 'Yes' : 'No',
          'Caravan Buys': stats.caravanBuys,
          'Crafted Into': stats.craftedInto,
          'Monster Drops': stats.monsterDrops,
          'Encounter Rewards': stats.encounterRewards,
          'Gather Sources': stats.gatherSources,
          'Caravan Sells': stats.caravanSells,
          Production: productionCount(stats),
        }
      : {
          Rarity: stats.rarity,
          Score: score(stats),
        };
  });

  console.table(table);
  if (!expanded) {
    console.log('(pass --expanded for the full per-source breakdown)');
  }

  const underUtilized = allStats.filter(
    (stats) => !stats.unobtainable && score(stats) <= threshold,
  );

  console.log(`\n=== Under-utilized materials (score <= ${threshold}) ===\n`);

  if (underUtilized.length === 0) {
    console.log('None - every obtainable material clears the threshold.');
    return;
  }

  underUtilized.forEach((stats) => {
    const sinks: string[] = [];
    if (stats.craftedFrom > 0) sinks.push(`${stats.craftedFrom} recipe(s)`);
    if (stats.caravanBuys > 0) sinks.push(`${stats.caravanBuys} caravan buy(s)`);
    if (stats.infusable) sinks.push('infusable');
    const sinkDescription =
      sinks.length > 0 ? sinks.join(', ') : 'no known sinks';

    const sources = productionCount(stats);
    console.log(
      `  - ${stats.name} [${stats.rarity}]: score=${score(stats)} (${sinkDescription}), ${sources} production source(s)`,
    );
  });

  console.log(
    `\n${underUtilized.length} of ${allStats.length} obtainable material(s) are under-utilized.`,
  );
}

main();
