/**
 * Reports gaps in item/equipment/infusion content across the level range
 * the game actually spans, so it's easy to spot "nothing new shows up here"
 * stretches while authoring gamedata.
 *
 * Two independent checks:
 *
 * 1. Equipment type coverage - for every `EquipmentItemType` (Sword, Ring,
 *    Hat, ...), buckets every obtainable `EquipmentContent.levelRequirement`
 *    into fixed-size windows (`--gap`, default 4) from level 1 up to the
 *    top content level, and flags any window with zero items of that type.
 *
 * 2. Infusion stat coverage - for every `BaseStat`, collects every
 *    `ItemContent` whose `infusionStats` grants that stat (mirroring
 *    `isInfusionMaterial` in `src/app/helpers/infusion.ts`), resolves each
 *    item's earliest obtainable level (see below), and checks the same
 *    level-window coverage. Separately (not per-stat), flags any two items
 *    whose entire `infusionStats` block matches exactly - a true pointless
 *    duplicate. Sharing a single stat's value isn't enough to flag: an item
 *    granting +0.5 Vitality/+1 Intelligence and another granting +0.5
 *    Vitality/+1 Strength are different, legitimate choices, not a
 *    sidegrade - only an identical whole block is. There's also no "value
 *    must strictly increase per level" check - most infusion items grant
 *    more than one stat, so a higher-level item can legitimately give less
 *    of stat A while making up for it with stat B, which a per-stat
 *    comparison can't see.
 *
 * 3. Tradeskill recipe coverage - for every `Tradeskill`, buckets every
 *    `RecipeContent.minTradeskillLevel` into 1-level windows (always 1, not
 *    `--gap` - the ask is "a new recipe every level", not every few levels)
 *    up to a shared top tradeskill level (the highest `maxTradeskillLevel`
 *    across *all* recipes of *any* tradeskill, unrelated to `maxContentLevel`
 *    - so a tradeskill that stops introducing recipes earlier than the
 *    others is flagged for every level past its own last recipe, not just
 *    capped at itself), and flags any level with no recipe newly available
 *    there. Every recipe counts, regardless of how
 *    it's obtained: recipes gated behind a world drop (a `recipeId`
 *    completion reward somewhere - see `isRecipeDropGated` in
 *    `src/app/helpers/recipes.ts`) are "found", everything else is "learned"
 *    automatically once the level gate is met, and `--expanded` labels each
 *    accordingly - but both count toward filling a level's gap, since the
 *    question here is whether the level has *a* path to a new recipe, not
 *    which path.
 *
 * Items have no authored level themselves, so their "earliest level" is
 * derived by collating every way they can enter a player's inventory:
 *   - monster drops, using the monster's earliest `levelRange.min` across
 *     every encounter/random-encounter it's assigned to (a monster can
 *     appear across several level ranges)
 *   - encounter/random-encounter `completionRewards`, using that node's
 *     `levelRange.min`
 *   - gathering node `gatherResults`, using that node's `levelRange.min`
 *   - tradeskill recipe results, using the recipe's `minTradeskillLevel`
 *   - caravan trader `sell` trades, using the *caravan's* `level.min` (not
 *     the trader's own `level`) for every caravan the trader is eligible to
 *     staff (its `category` is one of that caravan's `traderCategories` and
 *     its `level` falls within the caravan's `level` range) - the caravan's
 *     level range is what actually gates when a player can reach that node,
 *     the trader's own level only gates which caravans it can be assigned to
 *
 * The last source is on a different scale than the other three (tradeskill
 * building level, capped far lower than hero/node level - see
 * `.claude/extra/design.md`), so treating it as directly comparable is a
 * simplification. It's included because a material that's otherwise
 * unobtainable except via crafting still needs a "when do I get this"
 * answer, but take tradeskill-only levels with a grain of salt.
 *
 * The top content level is derived, not hardcoded - it's the highest
 * `levelRange.max` across every encounter, random encounter, and gathering
 * node currently authored.
 *
 * Runs against raw `gamedata/**\/*.yml` sources (matching by the authored
 * `name` field, same as `validate-obtainability.ts`), so it needs no build
 * step first. This is an analysis tool, not a CI gate - it always exits 0.
 *
 * Usage: ts-node scripts/analyze-contentgaps [--gap=4] [--expanded]
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const rec = require('recursive-readdir');

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMEDATA_DIR = path.join(ROOT_DIR, 'gamedata');

// Keep in sync with `EquipmentItemType` in `src/app/interfaces/equipment.ts`.
const ALL_EQUIPMENT_TYPES = [
  'Accessory',
  'Arrow',
  'Artifact',
  'Bow',
  'Charm',
  'Cloth Armor',
  'Dagger',
  'Dirk',
  'Hat',
  'Helm',
  'Mace',
  'Metal Armor',
  'Ring',
  'Shield',
  'Spear',
  'Staff',
  'Sword',
  'Trinket',
  'Whip',
];

// Keep in sync with `BaseStat` in `src/app/interfaces/stat.ts`.
const ALL_STATS = [
  'Intelligence',
  'Strength',
  'Vitality',
  'Resistance',
  'Agility',
  'Health',
  'Energy',
  'Luck',
];

// Keep in sync with `Tradeskill` in `src/app/interfaces/tradeskill.ts`.
const ALL_TRADESKILLS = [
  'Artificing',
  'Blacksmithing',
  'Jewelcrafting',
  'Tailoring',
  'Woodworking',
];

type LevelRange = { min: number; max: number };

type ItemSource = {
  level: number;
  kind: string;
  from: string;
};

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

function isInfusionStat(item: any, stat: string): boolean {
  const value = item.infusionStats?.[stat];
  return typeof value === 'number' && value !== 0;
}

// Fixed-size [start, end] windows from 1 to `maxLevel`, flagging any window
// that none of `levels` falls inside.
function gapWindows(
  levels: number[],
  maxLevel: number,
  gapSize: number,
): { start: number; end: number }[] {
  const windows: { start: number; end: number }[] = [];
  for (let start = 1; start <= maxLevel; start += gapSize) {
    const end = Math.min(start + gapSize - 1, maxLevel);
    const covered = levels.some((level) => level >= start && level <= end);
    if (!covered) windows.push({ start, end });
  }
  return windows;
}

function formatWindows(windows: { start: number; end: number }[]): string {
  return windows
    .map((w) => (w.start === w.end ? `${w.start}` : `${w.start}-${w.end}`))
    .join(', ');
}

function noteMonsterLevel(
  monsterLevels: Map<string, LevelRange>,
  monsterId: string | undefined,
  range: LevelRange | undefined,
): void {
  if (!monsterId || !range) return;

  const existing = monsterLevels.get(monsterId);
  if (!existing) {
    monsterLevels.set(monsterId, { min: range.min, max: range.max });
    return;
  }

  existing.min = Math.min(existing.min, range.min);
  existing.max = Math.max(existing.max, range.max);
}

function addSource(
  itemSources: Map<string, ItemSource[]>,
  itemId: string | undefined,
  level: number | undefined,
  kind: string,
  from: string,
): void {
  if (!itemId || level === undefined || !Number.isFinite(level)) return;

  const list = itemSources.get(itemId) ?? [];
  list.push({ level, kind, from });
  itemSources.set(itemId, list);
}

function earliestLevel(
  itemSources: Map<string, ItemSource[]>,
  name: string,
): number | undefined {
  const sources = itemSources.get(name);
  if (!sources || sources.length === 0) return undefined;
  return Math.min(...sources.map((s) => s.level));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const expanded = args.includes('--expanded');
  const gapArg = args.find((arg) => arg.startsWith('--gap='));
  const gapSize = gapArg ? Number(gapArg.split('=')[1]) : 4;

  if (!Number.isInteger(gapSize) || gapSize < 1) {
    console.error(
      'Usage: ts-node scripts/analyze-contentgaps [--gap=4] [--expanded]',
    );
    process.exit(1);
  }

  console.log('=== analyze:contentgaps ===\n');

  const [
    items,
    equipment,
    monsters,
    encounters,
    encounterRandoms,
    gatherings,
    recipes,
    caravans,
    caravanTraders,
  ] = await Promise.all([
    loadContentType('item'),
    loadContentType('equipment'),
    loadContentType('monster'),
    loadContentType('encounter'),
    loadContentType('encounterrandom'),
    loadContentType('gathering'),
    loadContentType('recipe'),
    loadContentType('caravan'),
    loadContentType('caravantrader'),
  ]);

  console.log(
    `Loaded ${items.length} item(s), ${equipment.length} equipment(s), ${monsters.length} monster(s).`,
  );
  console.log(
    `Loaded ${encounters.length} encounter(s), ${encounterRandoms.length} random encounter(s), ${gatherings.length} gathering node(s), ${recipes.length} recipe(s), ${caravans.length} caravan(s), ${caravanTraders.length} caravan trader(s).\n`,
  );

  // --- Top content level ---
  const nodeRanges: LevelRange[] = [
    ...encounters,
    ...encounterRandoms,
    ...gatherings,
  ]
    .map((n) => n.levelRange)
    .filter(Boolean);
  const maxContentLevel = Math.max(0, ...nodeRanges.map((r) => r.max));

  console.log(
    `Top content level: ${maxContentLevel} (derived from ${nodeRanges.length} node levelRange(s)).`,
  );
  console.log(`Gap window size: ${gapSize} level(s).\n`);

  // --- Monster level ranges (union across every encounter it appears in) ---
  const monsterLevels = new Map<string, LevelRange>();
  encounters.forEach((encounter) => {
    (encounter.fights ?? []).forEach((fight: any) => {
      (fight.monsters ?? []).forEach((m: any) =>
        noteMonsterLevel(monsterLevels, m.monsterId, encounter.levelRange),
      );
    });
  });
  encounterRandoms.forEach((encounter) => {
    (encounter.fights ?? []).forEach((fight: any) => {
      (fight.monsters ?? []).forEach((m: any) =>
        noteMonsterLevel(monsterLevels, m.monsterId, encounter.levelRange),
      );
    });
    (encounter.creaturePool ?? []).forEach((m: any) =>
      noteMonsterLevel(monsterLevels, m.monsterId, encounter.levelRange),
    );
  });

  const unassignedMonsters = monsters
    .map((m) => m.name)
    .filter((name) => !monsterLevels.has(name));
  if (unassignedMonsters.length > 0) {
    console.log(
      `Note: ${unassignedMonsters.length} monster(s) aren't assigned to any encounter/random encounter, so their drops have no derived level: ${unassignedMonsters.join(', ')}\n`,
    );
  }

  // --- Collate item sources (nodes + tradeskill crafts) ---
  const itemSources = new Map<string, ItemSource[]>();

  monsters.forEach((monster) => {
    const level = monsterLevels.get(monster.name)?.min;
    (monster.drops ?? []).forEach((drop: any) =>
      addSource(itemSources, drop.itemId, level, 'monster drop', monster.name),
    );
  });

  encounters.forEach((encounter) => {
    (encounter.completionRewards ?? []).forEach((reward: any) =>
      addSource(
        itemSources,
        reward.itemId,
        encounter.levelRange?.min,
        'encounter reward',
        encounter.name,
      ),
    );
  });

  encounterRandoms.forEach((encounter) => {
    (encounter.completionRewards ?? []).forEach((reward: any) =>
      addSource(
        itemSources,
        reward.itemId,
        encounter.levelRange?.min,
        'random encounter reward',
        encounter.name,
      ),
    );
  });

  gatherings.forEach((gathering) => {
    (gathering.gatherResults ?? []).forEach((result: any) => {
      (result.items ?? []).forEach((resultItem: any) =>
        addSource(
          itemSources,
          resultItem.itemId,
          gathering.levelRange?.min,
          'gathering',
          gathering.name,
        ),
      );
    });
  });

  recipes.forEach((recipe) => {
    addSource(
      itemSources,
      recipe.result?.itemId,
      recipe.minTradeskillLevel,
      'tradeskill craft',
      recipe.name,
    );
  });

  caravanTraders.forEach((trader) => {
    const eligibleCaravans = caravans.filter(
      (caravan: any) =>
        (caravan.traderCategories ?? []).includes(trader.category) &&
        trader.level >= caravan.level?.min &&
        trader.level <= caravan.level?.max,
    );

    (trader.trades ?? []).forEach((trade: any) => {
      if (trade.type !== 'sell' || !trade.itemId) return;

      eligibleCaravans.forEach((caravan: any) =>
        addSource(
          itemSources,
          trade.itemId,
          caravan.level?.min,
          'caravan trade',
          `${trader.name} @ ${caravan.name}`,
        ),
      );
    });
  });

  // === Part 1: equipment type coverage ===
  console.log('=== Equipment type coverage ===\n');

  const equipmentByType = new Map<string, any[]>();
  equipment
    .filter((e) => !e.unobtainable)
    .forEach((e) => {
      const list = equipmentByType.get(e.type) ?? [];
      list.push(e);
      equipmentByType.set(e.type, list);
    });

  const equipmentProblems: string[] = [];

  ALL_EQUIPMENT_TYPES.forEach((type) => {
    const entries = equipmentByType.get(type) ?? [];
    const levels = entries.map((e) => e.levelRequirement);

    if (entries.length === 0) {
      const message = `Equipment type "${type}" has no obtainable items at all.`;
      console.log(`  ✗ ${message}`);
      equipmentProblems.push(message);
      return;
    }

    const windows = gapWindows(levels, maxContentLevel, gapSize);
    if (windows.length > 0) {
      const message = `Equipment type "${type}" has no item introduced at level window(s): ${formatWindows(windows)} (checked 1..${maxContentLevel}, ${entries.length} item(s) total).`;
      console.log(`  ✗ ${message}`);
      equipmentProblems.push(message);
    } else {
      console.log(
        `  ✓ ${type}: levels 1..${maxContentLevel} all have at least one item (${entries.length} item(s) total).`,
      );
    }

    if (expanded) {
      const sorted = [...entries].sort(
        (a, b) => a.levelRequirement - b.levelRequirement,
      );
      sorted.forEach((e) =>
        console.log(`      - Lv${e.levelRequirement}: ${e.name} [${e.rarity}]`),
      );
    }
  });

  // === Part 2: infusion stat coverage ===
  console.log('\n=== Infusion stat coverage & duplication ===\n');

  const infusionProblems: string[] = [];

  ALL_STATS.forEach((stat) => {
    type StatEntry = { name: string; level: number; value: number };

    const statItems = items.filter((item) => isInfusionStat(item, stat));
    const entries: StatEntry[] = statItems
      .map((item) => ({
        name: item.name,
        level: earliestLevel(itemSources, item.name),
        value: item.infusionStats[stat],
      }))
      .filter((e): e is StatEntry => e.level !== undefined)
      .sort((a, b) => a.level - b.level || a.value - b.value);

    const unsourced = statItems.filter(
      (item) => earliestLevel(itemSources, item.name) === undefined,
    );

    if (statItems.length === 0) {
      console.log(`  (info) No item grants ${stat} via infusion.`);
      return;
    }

    console.log(`  ${stat}: ${statItems.length} infusion item(s) found.`);

    if (unsourced.length > 0) {
      console.log(
        `      Note: ${unsourced.length} item(s) grant ${stat} but have no derived level (no known drop/reward/gather/recipe/caravan-trade source): ${unsourced.map((i) => i.name).join(', ')}`,
      );
    }

    if (expanded) {
      entries.forEach((e) =>
        console.log(`      - Lv${e.level}: ${e.name} = ${e.value}`),
      );
    }

    // Coverage
    const windows = gapWindows(
      entries.map((e) => e.level),
      maxContentLevel,
      gapSize,
    );
    if (windows.length > 0) {
      const message = `${stat} infusion has no item introduced at level window(s): ${formatWindows(windows)} (checked 1..${maxContentLevel}).`;
      console.log(`      ✗ ${message}`);
      infusionProblems.push(message);
    } else {
      console.log(
        `      ✓ levels 1..${maxContentLevel} all have at least one ${stat} infusion item.`,
      );
    }
  });

  // Duplicate stat *blocks* - two items are only a pointless duplicate if
  // every infusion stat they grant matches exactly. An item sharing one
  // stat's value with another (e.g. both grant +0.5 Vitality) is not a
  // duplicate on its own if the rest of their blocks differ (e.g. one also
  // grants Intelligence, the other Strength) - that's two distinct,
  // legitimate choices, not a sidegrade.
  const infusableItems = items.filter((item) =>
    ALL_STATS.some((stat) => isInfusionStat(item, stat)),
  );

  const byStatBlock = new Map<string, string[]>();
  infusableItems.forEach((item) => {
    const key = ALL_STATS.filter((stat) => isInfusionStat(item, stat))
      .sort()
      .map((stat) => `${stat}:${item.infusionStats[stat]}`)
      .join('|');

    const names = byStatBlock.get(key) ?? [];
    names.push(item.name);
    byStatBlock.set(key, names);
  });

  byStatBlock.forEach((names, key) => {
    if (names.length <= 1) return;
    const message = `Items ${names.join(', ')} all grant the exact same infusion stat block (${key.split('|').join(', ')}) - one of these is a pointless duplicate.`;
    console.log(`  ✗ ${message}`);
    infusionProblems.push(message);
  });

  // === Part 3: tradeskill recipe coverage ===
  console.log('\n=== Tradeskill recipe coverage ===\n');

  const dropGatedRecipeNames = new Set<string>();
  [...encounters, ...encounterRandoms].forEach((encounter) => {
    (encounter.completionRewards ?? []).forEach((reward: any) => {
      if (reward.recipeId) dropGatedRecipeNames.add(reward.recipeId);
    });
  });

  const recipesByTradeskill = new Map<string, any[]>();
  recipes.forEach((r) => {
    const list = recipesByTradeskill.get(r.tradeskill) ?? [];
    list.push(r);
    recipesByTradeskill.set(r.tradeskill, list);
  });

  // Shared across every tradeskill, not derived per-tradeskill - a
  // tradeskill that stops introducing recipes early should show up as
  // gapped up to the same ceiling as the tradeskill that goes furthest,
  // instead of the check quietly capping itself to its own last recipe.
  const topTradeskillLevel = Math.max(
    0,
    ...recipes.map((r) => r.maxTradeskillLevel),
  );

  const recipeProblems: string[] = [];

  ALL_TRADESKILLS.forEach((tradeskill) => {
    const entries = recipesByTradeskill.get(tradeskill) ?? [];

    if (entries.length === 0) {
      const message = `Tradeskill "${tradeskill}" has no recipes at all.`;
      console.log(`  ✗ ${message}`);
      recipeProblems.push(message);
      return;
    }

    const topLevel = topTradeskillLevel;
    const levels = entries.map((r) => r.minTradeskillLevel);

    const windows = gapWindows(levels, topLevel, 1);
    if (windows.length > 0) {
      const message = `Tradeskill "${tradeskill}" has no new recipe introduced at level(s): ${formatWindows(windows)} (checked 1..${topLevel}, ${entries.length} recipe(s) total).`;
      console.log(`  ✗ ${message}`);
      recipeProblems.push(message);
    } else {
      console.log(
        `  ✓ ${tradeskill}: levels 1..${topLevel} each have at least one new recipe (${entries.length} recipe(s) total).`,
      );
    }

    if (expanded) {
      const sorted = [...entries].sort(
        (a, b) => a.minTradeskillLevel - b.minTradeskillLevel,
      );
      sorted.forEach((r) => {
        const gate = dropGatedRecipeNames.has(r.name) ? 'found' : 'learned';
        console.log(`      - Lv${r.minTradeskillLevel}: ${r.name} [${gate}]`);
      });
    }
  });

  // === Summary ===
  console.log('\n=== Summary ===\n');

  const totalProblems =
    equipmentProblems.length + infusionProblems.length + recipeProblems.length;
  if (totalProblems === 0) {
    console.log('No content gaps found.');
    return;
  }

  console.log(
    `${equipmentProblems.length} equipment coverage problem(s), ${infusionProblems.length} infusion problem(s), ${recipeProblems.length} tradeskill recipe problem(s) - ${totalProblems} total.`,
  );
}

main();
