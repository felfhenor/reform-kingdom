/**
 * Validates that every "field node" (a Tiled `ExploreNode` object placed on
 * one of the world maps) has a matching `Encounter` content entry, matched
 * by name (`ExploreNode.name` === `Encounter.name`).
 *
 * This checks the *compiled* JSON output (`public/maps/*.json`,
 * `public/json/maps.json`, `public/json/encounter.json`) rather than the
 * raw `gamemaps/*.json` / `gamedata/encounter/*.yml` sources, so it must run
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

const FIELD_NODE_LAYER_NAME = 'Explore Nodes';
const FIELD_NODE_TYPE = 'ExploreNode';

type FieldNodeRef = {
  mapName: string;
  nodeName: string;
  x: number;
  y: number;
};

function loadRequiredJson(filePath: string, description: string): any {
  if (!fs.existsSync(filePath)) {
    console.log(
      `::error::[validate:fieldnodes] Could not find ${description} at "${filePath}". ` +
        `Run "npm run build" (or "npm run build:maps" and "npm run gamedata:build") before validating.`,
    );
    console.error(
      `[validate:fieldnodes] FATAL: missing ${description} at "${filePath}".`,
    );
    process.exit(1);
  }

  return fs.readJsonSync(filePath);
}

function main(): void {
  console.log('=== validate:fieldnodes ===');
  console.log(
    'Checking that every ExploreNode on every map has a matching Encounter (matched by name).\n',
  );

  console.log(`Loading compiled map list from ${MAP_NAMES_FILE}...`);
  const mapNames: string[] = loadRequiredJson(
    MAP_NAMES_FILE,
    'the compiled map list (public/json/maps.json)',
  );
  console.log(`  Found ${mapNames.length} map(s): ${mapNames.join(', ') || '(none)'}`);

  console.log(`\nLoading compiled encounters from ${ENCOUNTER_FILE}...`);
  const encounters: Array<{ id: string; name: string }> = loadRequiredJson(
    ENCOUNTER_FILE,
    'compiled encounter content (public/json/encounter.json)',
  );
  const encounterNames = new Set(encounters.map((encounter) => encounter.name));
  console.log(
    `  Found ${encounters.length} encounter(s): ${
      [...encounterNames].join(', ') || '(none)'
    }`,
  );

  const allFieldNodes: FieldNodeRef[] = [];
  const missing: FieldNodeRef[] = [];

  mapNames.forEach((mapName) => {
    const mapPath = path.join(MAPS_DIR, `${mapName}.json`);
    console.log(`\nChecking map "${mapName}" (${mapPath})...`);

    const map = loadRequiredJson(mapPath, `compiled map "${mapName}"`);

    const layer = (map.layers ?? []).find(
      (candidate: any) => candidate.name === FIELD_NODE_LAYER_NAME,
    );

    if (!layer) {
      console.log(
        `  No "${FIELD_NODE_LAYER_NAME}" layer found on "${mapName}"; skipping (0 field nodes).`,
      );
      return;
    }

    const fieldNodes = (layer.objects ?? []).filter(
      (object: any) => object.type === FIELD_NODE_TYPE,
    );

    console.log(`  Found ${fieldNodes.length} field node(s) on "${mapName}".`);

    fieldNodes.forEach((node: any) => {
      const ref: FieldNodeRef = {
        mapName,
        nodeName: node.name,
        x: node.x,
        y: node.y,
      };
      allFieldNodes.push(ref);

      if (encounterNames.has(node.name)) {
        console.log(
          `  ✓ "${node.name}" @ (${node.x}, ${node.y}) -> matches encounter "${node.name}".`,
        );
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
    `Checked ${allFieldNodes.length} field node(s) across ${mapNames.length} map(s); ${encounters.length} encounter(s) available.`,
  );

  if (missing.length > 0) {
    console.log(
      `\n${missing.length} of ${allFieldNodes.length} field node(s) have NO matching encounter:\n`,
    );

    missing.forEach((ref) => {
      const message =
        `Field node "${ref.nodeName}" on map "${ref.mapName}" (tile x=${ref.x}, y=${ref.y}) ` +
        `has no Encounter whose "name" is "${ref.nodeName}". ` +
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
      `\n[validate:fieldnodes] FAILED: ${missing.length} field node(s) are missing a corresponding encounter.`,
    );
    process.exit(1);
  }

  console.log('\n[validate:fieldnodes] PASSED: every field node has a corresponding encounter.');
}

main();
