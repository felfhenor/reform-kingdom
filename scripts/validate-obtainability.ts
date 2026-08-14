/**
 * Validates that every item, collectible, and equipment entry is actually
 * obtainable in game - dropped by a monster (`MonsterContent.drops`),
 * granted by an encounter's or random encounter's completion
 * (`EncounterContent.completionRewards`/`EncounterRandomContent.completionRewards`),
 * gathered from a node (`GatheringContent.gatherResults`, items only),
 * produced by crafting a recipe (`RecipeContent.result`), or hardcoded as a
 * guaranteed starting grant (see `GUARANTEED_GRANT_NAMES` below) - unless
 * the entry is explicitly marked `unobtainable: true` (see `ItemContent`,
 * `EquipmentContent`, `CollectibleContent`). Those are the only places
 * `armoryAdd`/`collectiblesAdd`/`addMaterial` are ever called from
 * production code (`combat-end.ts`, `crafting.ts`, `gathering.ts`,
 * `party.ts`, `collectibles.ts`) - anything else has no way to reach a
 * player's inventory and is either dead content or missing its drop/reward/
 * recipe wiring.
 *
 * A caravan trader's `sell` trades (`gamedata/caravantrader/*.yml`) also
 * count as a source - the party can buy that item/equipment/collectible for
 * gold, same as any drop/reward/gather/recipe. `buy` trades don't count -
 * the trader taking something *from* the party isn't a way to obtain it.
 *
 * Runs against the raw `gamedata/**\/*.yml` sources rather than compiled
 * output, matching by the authored `name` field (the same identifier
 * `itemId`/`equipmentId`/`collectibleId` references use pre-build - see
 * `scripts/gamedata-build.ts`), so it needs no build step first.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import * as yaml from 'js-yaml';
import rec from 'recursive-readdir';

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMEDATA_DIR = path.join(ROOT_DIR, 'gamedata');

// Content granted unconditionally by game code rather than any drop/reward/
// recipe - kept in sync by hand with the `getEntry` lookups that hand these
// out for free: `STARTER_ARMOR_NAME`/`STARTER_HAT_NAME` in
// `src/app/helpers/party.ts` (every new character's starting Armor/Helmet
// slots) and `FOUNDING_STONE_NAME` in `src/app/helpers/collectibles.ts`
// (granted to every save on creation/migration). If game code ever adds
// another guaranteed grant, add its name here too.
const GUARANTEED_GRANT_NAMES = new Set<string>([
  'Cloak of Adventuring',
  'Hat of Adventuring',
  'Founding Stone',
]);

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

function addIfPresent(set: Set<string>, value: unknown): void {
  if (typeof value === 'string') set.add(value);
}

// Shared by monster `drops` and encounter/random-encounter
// `completionRewards` - all are `DroppedReward[]` (see
// `interfaces/droppable.ts`).
function collectFromDroppedRewards(
  rewards: any[] | undefined,
  itemNames: Set<string>,
  equipmentNames: Set<string>,
  collectibleNames: Set<string>,
): void {
  (rewards ?? []).forEach((reward) => {
    addIfPresent(itemNames, reward.itemId);
    addIfPresent(equipmentNames, reward.equipmentId);
    addIfPresent(collectibleNames, reward.collectibleId);
  });
}

async function main(): Promise<void> {
  console.log('=== validate:obtainability ===');
  console.log(
    'Checking that every item/collectible/equipment is reachable via a drop, reward, gather, or recipe.\n',
  );

  const [
    items,
    collectibles,
    equipment,
    monsters,
    encounters,
    encounterRandoms,
    gatherings,
    recipes,
    caravanTraders,
  ] = await Promise.all([
    loadContentType('item'),
    loadContentType('collectible'),
    loadContentType('equipment'),
    loadContentType('monster'),
    loadContentType('encounter'),
    loadContentType('encounterrandom'),
    loadContentType('gathering'),
    loadContentType('recipe'),
    loadContentType('caravantrader'),
  ]);

  console.log(
    `Loaded ${items.length} item(s), ${collectibles.length} collectible(s), ${equipment.length} equipment(s).`,
  );
  console.log(
    `Loaded ${monsters.length} monster(s), ${encounters.length} encounter(s), ${encounterRandoms.length} random encounter(s), ${gatherings.length} gathering node(s), ${recipes.length} recipe(s), ${caravanTraders.length} caravan trader(s) as potential sources.\n`,
  );

  const obtainableItems = new Set<string>();
  const obtainableEquipment = new Set<string>();
  const obtainableCollectibles = new Set<string>();

  monsters.forEach((monster) =>
    collectFromDroppedRewards(
      monster.drops,
      obtainableItems,
      obtainableEquipment,
      obtainableCollectibles,
    ),
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
    (gathering.gatherResults ?? []).forEach((result: any) => {
      (result.items ?? []).forEach((item: any) =>
        addIfPresent(obtainableItems, item.itemId),
      );
    });
  });

  recipes.forEach((recipe) => {
    const result = recipe.result ?? {};
    addIfPresent(obtainableItems, result.itemId);
    addIfPresent(obtainableEquipment, result.equipmentId);
    addIfPresent(obtainableCollectibles, result.collectibleId);
  });

  caravanTraders.forEach((trader) => {
    (trader.trades ?? []).forEach((trade: any) => {
      if (trade.type !== 'sell') return;
      addIfPresent(obtainableItems, trade.itemId);
      addIfPresent(obtainableEquipment, trade.equipmentId);
      addIfPresent(obtainableCollectibles, trade.collectibleId);
    });
  });

  const problems: string[] = [];

  function checkCandidates(
    kind: string,
    candidates: any[],
    obtainableNames: Set<string>,
  ): void {
    candidates.forEach((candidate) => {
      if (candidate.unobtainable) {
        console.log(`  (skipping "${candidate.name}" [${kind}] - marked unobtainable)`);
        return;
      }

      if (GUARANTEED_GRANT_NAMES.has(candidate.name)) {
        console.log(`  ✓ "${candidate.name}" [${kind}] is a guaranteed starting grant.`);
        return;
      }

      if (obtainableNames.has(candidate.name)) {
        console.log(`  ✓ "${candidate.name}" [${kind}] is obtainable.`);
        return;
      }

      const message =
        `${kind} "${candidate.name}" has no drop, completion reward, gather result, ` +
        `or recipe result that produces it, and is not marked "unobtainable: true".`;
      console.log(`  ✗ ${message}`);
      problems.push(message);
    });
  }

  checkCandidates('Item', items, obtainableItems);
  checkCandidates('Collectible', collectibles, obtainableCollectibles);
  checkCandidates('Equipment', equipment, obtainableEquipment);

  console.log('\n=== Summary ===');

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s) found:\n`);
    problems.forEach((message) => {
      console.log(`  - ${message}`);
      console.log(`::error::${message}`);
    });

    console.error(
      `\n[validate:obtainability] FAILED: ${problems.length} entrie(s) have no way to be obtained.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:obtainability] PASSED: every item/collectible/equipment is either obtainable or marked unobtainable.',
  );
}

main();
