/**
 * Validates that every node object placed on the world maps (on the
 * "Explore Nodes" or "Other Nodes" layers - the same layers `worldNodeMapsBuild`
 * in `src/app/helpers/world-nodes.ts` reads) has a name that's unique across
 * *all* maps, regardless of node type.
 *
 * `worldNodeMapsBuild` indexes every node into a single flat `byName` map
 * keyed only by name - it isn't scoped by map or type. Two nodes sharing a
 * name (even a `Kingdom` node on one map and a `TeleportNode` on another)
 * silently clobber each other in that lookup, and whichever one loses
 * disappears from travel, pathfinding, and anything else that resolves nodes
 * by name.
 *
 * This checks the raw source maps (`gamemaps/*.json`) rather than the
 * compiled output, since node `properties` are copied verbatim by
 * `npm run build:maps` and this script has no other build-time dependency.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';

const GAMEMAPS_DIR = path.resolve(__dirname, '../gamemaps');

const NODE_LAYER_NAMES = ['Explore Nodes', 'Other Nodes'];

type NodeRef = {
  mapName: string;
  nodeName: string;
  nodeType: string;
  x: number;
  y: number;
};

function main(): void {
  console.log('=== validate:nodenames ===');
  console.log(
    'Checking that every node name on "Explore Nodes"/"Other Nodes" layers is unique across all maps.\n',
  );

  const mapFiles: string[] = fs
    .readdirSync(GAMEMAPS_DIR)
    .filter((file: string) => file.endsWith('.json'));

  const allNodes: NodeRef[] = [];
  const nameOwners = new Map<string, NodeRef>();
  const duplicateNames: NodeRef[] = [];

  mapFiles.forEach((file: string) => {
    const mapName = path.basename(file, '.json');
    const mapPath = path.join(GAMEMAPS_DIR, file);
    const map = fs.readJsonSync(mapPath);

    console.log(`Checking map "${mapName}" (${mapPath})...`);

    const nodes = (map.layers ?? [])
      .filter((layer: any) => NODE_LAYER_NAMES.includes(layer.name))
      .flatMap((layer: any) => layer.objects ?? []);

    console.log(`  Found ${nodes.length} node(s) on "${mapName}".`);

    nodes.forEach((node: any) => {
      const ref: NodeRef = {
        mapName,
        nodeName: node.name,
        nodeType: node.type,
        x: node.x,
        y: node.y,
      };
      allNodes.push(ref);

      const existingOwner = nameOwners.get(ref.nodeName);
      if (existingOwner) {
        console.log(
          `  ✗ "${ref.nodeName}" (${ref.nodeType}) -> name already used by "${existingOwner.nodeName}" ` +
            `(${existingOwner.nodeType}) on "${existingOwner.mapName}".`,
        );
        duplicateNames.push(ref);
      } else {
        nameOwners.set(ref.nodeName, ref);
        console.log(`  ✓ "${ref.nodeName}" (${ref.nodeType}).`);
      }
    });
  });

  console.log('\n=== Summary ===');
  console.log(
    `Checked ${allNodes.length} node(s) across ${mapFiles.length} map(s); ${nameOwners.size} unique name(s) found.`,
  );

  if (duplicateNames.length > 0) {
    console.log(`\n${duplicateNames.length} problem(s) found:\n`);

    duplicateNames.forEach((ref) => {
      const owner = nameOwners.get(ref.nodeName)!;
      const message =
        `Node "${ref.nodeName}" (${ref.nodeType}) on map "${ref.mapName}" (tile x=${ref.x / 64}, y=${1 + ref.y / 64}) ` +
        `shares its name with "${owner.nodeName}" (${owner.nodeType}) on map "${owner.mapName}". ` +
        `Node names must be unique across every map - rename one of them.`;

      console.log(`  - ${message}`);
      console.log(
        `::error file=${path.relative(
          path.resolve(__dirname, '..'),
          path.join(GAMEMAPS_DIR, `${ref.mapName}.json`),
        )}::${message}`,
      );
    });

    console.error(
      `\n[validate:nodenames] FAILED: ${duplicateNames.length} node name collision(s) found.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:nodenames] PASSED: every node name is unique across all maps.',
  );
}

main();
