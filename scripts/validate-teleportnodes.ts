/**
 * Validates that every `TeleportNode` object placed on the world maps has a
 * `tag` and `toTag` string property, that no two `TeleportNode`s share the
 * same `tag` (which would make `toTag` references ambiguous), and that
 * every `toTag` references a `tag` that actually exists somewhere across
 * the maps.
 *
 * This checks the raw source maps (`gamemaps/*.json`) rather than the
 * compiled output, since node `properties` are copied verbatim by
 * `npm run build:maps` and this script has no other build-time dependency.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('fs-extra');
const path = require('path');

const GAMEMAPS_DIR = path.resolve(__dirname, '../gamemaps');

const TELEPORT_NODE_TYPE = 'TeleportNode';

type TeleportNodeRef = {
  mapName: string;
  nodeName: string;
  tag: string | undefined;
  toTag: string | undefined;
};

function propertyValue(object: any, propertyName: string): string | undefined {
  const property = (object.properties ?? []).find(
    (candidate: any) => candidate.name === propertyName,
  );

  if (typeof property?.value !== 'string' || property.value.trim() === '') {
    return undefined;
  }

  return property.value;
}

function main(): void {
  console.log('=== validate:teleportnodes ===');
  console.log(
    'Checking that every TeleportNode has a tag/toTag, tags are unique, and every toTag resolves to a tag.\n',
  );

  const mapFiles: string[] = fs
    .readdirSync(GAMEMAPS_DIR)
    .filter((file: string) => file.endsWith('.json'));

  const allTeleportNodes: TeleportNodeRef[] = [];
  const tagOwners = new Map<string, TeleportNodeRef>();
  const missingProperties: TeleportNodeRef[] = [];
  const duplicateTags: TeleportNodeRef[] = [];

  mapFiles.forEach((file: string) => {
    const mapName = path.basename(file, '.json');
    const mapPath = path.join(GAMEMAPS_DIR, file);
    const map = fs.readJsonSync(mapPath);

    console.log(`Checking map "${mapName}" (${mapPath})...`);

    const teleportNodes = (map.layers ?? []).flatMap((layer: any) =>
      (layer.objects ?? []).filter(
        (object: any) => object.type === TELEPORT_NODE_TYPE,
      ),
    );

    console.log(`  Found ${teleportNodes.length} teleport node(s) on "${mapName}".`);

    teleportNodes.forEach((node: any) => {
      const ref: TeleportNodeRef = {
        mapName,
        nodeName: node.name,
        tag: propertyValue(node, 'tag'),
        toTag: propertyValue(node, 'toTag'),
      };
      allTeleportNodes.push(ref);
      let hadProblem = false;

      if (!ref.tag || !ref.toTag) {
        console.log(
          `  ✗ "${ref.nodeName}" -> missing ${!ref.tag ? '"tag"' : ''}${
            !ref.tag && !ref.toTag ? ' and ' : ''
          }${!ref.toTag ? '"toTag"' : ''} property.`,
        );
        missingProperties.push(ref);
        hadProblem = true;
      }

      if (ref.tag) {
        const existingOwner = tagOwners.get(ref.tag);
        if (existingOwner) {
          console.log(
            `  ✗ "${ref.nodeName}" -> tag "${ref.tag}" is already used by "${existingOwner.nodeName}" on "${existingOwner.mapName}".`,
          );
          duplicateTags.push(ref);
          hadProblem = true;
        } else {
          tagOwners.set(ref.tag, ref);
        }
      }

      if (!hadProblem) {
        console.log(`  ✓ "${ref.nodeName}" -> tag="${ref.tag}", toTag="${ref.toTag}".`);
      }
    });
  });

  const unresolvedToTags = allTeleportNodes.filter(
    (ref) => ref.toTag && !tagOwners.has(ref.toTag),
  );

  console.log('\n=== Summary ===');
  console.log(
    `Checked ${allTeleportNodes.length} teleport node(s) across ${mapFiles.length} map(s); ${tagOwners.size} unique tag(s) found.`,
  );

  const problems = [
    ...missingProperties.map((ref) => ({
      ref,
      message:
        `Teleport node "${ref.nodeName}" on map "${ref.mapName}" is missing a ` +
        `${!ref.tag ? '"tag"' : '"toTag"'} property. Add it to the node's Custom Properties in Tiled.`,
    })),
    ...duplicateTags.map((ref) => ({
      ref,
      message:
        `Teleport node "${ref.nodeName}" on map "${ref.mapName}" has tag "${ref.tag}", ` +
        `which is already used by another teleport node. Tags must be unique across all maps.`,
    })),
    ...unresolvedToTags.map((ref) => ({
      ref,
      message:
        `Teleport node "${ref.nodeName}" on map "${ref.mapName}" has toTag "${ref.toTag}", ` +
        `which does not match any teleport node's "tag". Add a teleport node with tag="${ref.toTag}", or fix the typo.`,
    })),
  ];

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s) found:\n`);

    problems.forEach(({ ref, message }) => {
      console.log(`  - ${message}`);
      console.log(
        `::error file=${path.relative(
          path.resolve(__dirname, '..'),
          path.join(GAMEMAPS_DIR, `${ref.mapName}.json`),
        )}::${message}`,
      );
    });

    console.error(
      `\n[validate:teleportnodes] FAILED: ${problems.length} problem(s) found across teleport nodes.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:teleportnodes] PASSED: every teleport node has a valid tag/toTag.',
  );
}

main();
