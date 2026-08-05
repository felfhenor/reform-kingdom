/**
 * Validates that every "explore node" (a Tiled `ExploreNode` object placed on
 * one of the world maps) resolves to an `Encounter` (matched by name -
 * `node.name` === `Encounter.name`) whose `completionRewards` includes at
 * least one collectible drop. Every explorable ruin is meant to guarantee a
 * curio, so a missing `collectibleId` reward is treated the same as a
 * missing/empty `completionRewards` array.
 *
 * This checks the *compiled* JSON output (`public/maps/*.json`,
 * `public/json/maps.json`, `public/json/encounter.json`) rather than the raw
 * `gamemaps/*.json` / `gamedata/encounter/*.yml` sources, so it must run
 * after `npm run build` (or at minimum `npm run build:maps` and
 * `npm run gamedata:build`) has produced those files.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('fs-extra');
const path = require('path');

const MAPS_DIR = path.resolve(__dirname, '../public/maps');
const MAP_NAMES_FILE = path.resolve(__dirname, '../public/json/maps.json');
const ENCOUNTER_FILE = path.resolve(__dirname, '../public/json/encounter.json');
const GAMEMAPS_DIR = path.resolve(__dirname, '../gamemaps');

const EXPLORE_NODE_LAYER_NAME = 'Explore Nodes';
const EXPLORE_NODE_TYPE = 'ExploreNode';

type ExploreNodeRef = {
  mapName: string;
  nodeName: string;
  x: number;
  y: number;
};

function loadRequiredJson(filePath: string, description: string): any {
  if (!fs.existsSync(filePath)) {
    console.log(
      `::error::[validate:completionrewards] Could not find ${description} at "${filePath}". ` +
        `Run "npm run build" (or "npm run build:maps" and "npm run gamedata:build") before validating.`,
    );
    console.error(
      `[validate:completionrewards] FATAL: missing ${description} at "${filePath}".`,
    );
    process.exit(1);
  }

  return fs.readJsonSync(filePath);
}

function hasCollectibleReward(encounter: any): boolean {
  return (encounter.completionRewards ?? []).some(
    (reward: any) => !!reward.collectibleId,
  );
}

function main(): void {
  console.log('=== validate:completionrewards ===');
  console.log(
    'Checking that every ExploreNode on every map resolves to an Encounter with at least one collectible completion reward.\n',
  );

  console.log(`Loading compiled map list from ${MAP_NAMES_FILE}...`);
  const mapNames: string[] = loadRequiredJson(
    MAP_NAMES_FILE,
    'the compiled map list (public/json/maps.json)',
  );
  console.log(`  Found ${mapNames.length} map(s): ${mapNames.join(', ') || '(none)'}`);

  console.log(`\nLoading compiled encounters from ${ENCOUNTER_FILE}...`);
  const encounters: Array<{ id: string; name: string; completionRewards?: any[] }> =
    loadRequiredJson(
      ENCOUNTER_FILE,
      'compiled encounter content (public/json/encounter.json)',
    );
  const encountersByName = new Map(
    encounters.map((encounter) => [encounter.name, encounter]),
  );
  console.log(
    `  Found ${encounters.length} encounter(s): ${
      [...encountersByName.keys()].join(', ') || '(none)'
    }`,
  );

  const allExploreNodes: ExploreNodeRef[] = [];
  const missing: ExploreNodeRef[] = [];

  mapNames.forEach((mapName) => {
    const mapPath = path.join(MAPS_DIR, `${mapName}.json`);
    console.log(`\nChecking map "${mapName}" (${mapPath})...`);

    const map = loadRequiredJson(mapPath, `compiled map "${mapName}"`);

    const layer = (map.layers ?? []).find(
      (candidate: any) => candidate.name === EXPLORE_NODE_LAYER_NAME,
    );

    if (!layer) {
      console.log(
        `  No "${EXPLORE_NODE_LAYER_NAME}" layer found on "${mapName}"; skipping (0 explore nodes).`,
      );
      return;
    }

    const exploreNodes = (layer.objects ?? []).filter(
      (object: any) => object.type === EXPLORE_NODE_TYPE,
    );

    console.log(`  Found ${exploreNodes.length} explore node(s) on "${mapName}".`);

    exploreNodes.forEach((node: any) => {
      const ref: ExploreNodeRef = {
        mapName,
        nodeName: node.name,
        x: node.x,
        y: node.y,
      };
      allExploreNodes.push(ref);

      const encounter = encountersByName.get(node.name);

      if (encounter && hasCollectibleReward(encounter)) {
        console.log(
          `  ✓ "${node.name}" @ (${node.x}, ${node.y}) -> has a collectible completion reward.`,
        );
      } else if (encounter) {
        console.log(
          `  ✗ "${node.name}" @ (${node.x}, ${node.y}) -> encounter has NO collectible completion reward!`,
        );
        missing.push(ref);
      } else {
        console.log(
          `  ✗ "${node.name}" @ (${node.x}, ${node.y}) -> NO matching encounter!`,
        );
        missing.push(ref);
      }
    });
  });

  console.log('\n=== Summary ===');
  console.log(
    `Checked ${allExploreNodes.length} explore node(s) across ${mapNames.length} map(s).`,
  );

  if (missing.length > 0) {
    console.log(
      `\n${missing.length} of ${allExploreNodes.length} explore node(s) are missing a collectible completion reward:\n`,
    );

    missing.forEach((ref) => {
      const message =
        `Explore node "${ref.nodeName}" on map "${ref.mapName}" (tile x=${ref.x}, y=${ref.y}) ` +
        `has no Encounter entry named "${ref.nodeName}" with a "collectibleId" completion reward. ` +
        `Add one to gamedata/encounter/*.yml, then rerun "npm run gamedata:build".`;

      console.log(`  - ${message}`);
      console.log(
        `::error file=${path.relative(
          path.resolve(__dirname, '..'),
          path.join(GAMEMAPS_DIR, `${ref.mapName}.json`),
        )}::${message}`,
      );
    });

    console.error(
      `\n[validate:completionrewards] FAILED: ${missing.length} explore node(s) have no collectible completion reward.`,
    );
    process.exit(1);
  }

  console.log('\n[validate:completionrewards] PASSED: every explore node has a collectible completion reward.');
}

main();
