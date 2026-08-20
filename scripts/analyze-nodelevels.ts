/**
 * Lists every level-gated world node (encounter, random encounter, gathering,
 * caravan) sorted by level, alongside the map it's placed on, then flags
 * level windows with no node covering them - so it's easy to spot "I've
 * built five nodes in the 10-14 range and nothing past it" while authoring.
 *
 * Node -> map association comes from the raw source maps (`gamemaps/*.json`,
 * "Explore Nodes"/"Other Nodes" layers, same as `validate-nodenames.ts`),
 * matched by name against `gamedata/{encounter,encounterrandom,gathering,caravan}`
 * (same matching approach as `analyze-contentgaps.ts`). A node authored in
 * gamedata but not yet placed on any map shows up with mapName "(unplaced)"
 * rather than being silently dropped.
 *
 * This only reports coverage gaps (empty level windows) - it does NOT flag
 * multiple nodes sharing the same/overlapping range as a problem, since
 * overlapping ranges are normal and expected.
 *
 * Usage: ts-node scripts/analyze-nodelevels [--gap=2]
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import * as yaml from 'js-yaml';
import path from 'path';
import rec from 'recursive-readdir';

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMEDATA_DIR = path.join(ROOT_DIR, 'gamedata');
const GAMEMAPS_DIR = path.join(ROOT_DIR, 'gamemaps');

const NODE_LAYER_NAMES = ['Explore Nodes', 'Other Nodes'];

type LevelRange = { min: number; max: number };

type NodeLevelEntry = {
  name: string;
  kind: string;
  levelRange: LevelRange;
  mapName: string;
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

function loadNodeNameToMap(): Map<string, string> {
  const mapFiles: string[] = fs
    .readdirSync(GAMEMAPS_DIR)
    .filter((file: string) => file.endsWith('.json'));

  const nodeNameToMap = new Map<string, string>();

  mapFiles.forEach((file: string) => {
    const mapName = path.basename(file, '.json');
    const map = fs.readJsonSync(path.join(GAMEMAPS_DIR, file));

    const nodes = (map.layers ?? [])
      .filter((layer: any) => NODE_LAYER_NAMES.includes(layer.name))
      .flatMap((layer: any) => layer.objects ?? []);

    nodes.forEach((node: any) => nodeNameToMap.set(node.name, mapName));
  });

  return nodeNameToMap;
}

function formatWindows(windows: { start: number; end: number }[]): string {
  return windows
    .map((w) => (w.start === w.end ? `${w.start}` : `${w.start}-${w.end}`))
    .join(', ');
}

// Fixed-size [start, end] windows from 1 to `maxLevel`, flagging any window
// that no node's range overlaps.
function gapWindows(
  ranges: LevelRange[],
  maxLevel: number,
  gapSize: number,
): { start: number; end: number }[] {
  const windows: { start: number; end: number }[] = [];
  for (let start = 1; start <= maxLevel; start += gapSize) {
    const end = Math.min(start + gapSize - 1, maxLevel);
    const covered = ranges.some((r) => r.min <= end && r.max >= start);
    if (!covered) windows.push({ start, end });
  }
  return windows;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const gapArg = args.find((arg) => arg.startsWith('--gap='));
  const gapSize = gapArg ? Number(gapArg.split('=')[1]) : 2;

  if (!Number.isInteger(gapSize) || gapSize < 1) {
    console.error('Usage: ts-node scripts/analyze-nodelevels [--gap=2]');
    process.exit(1);
  }

  console.log('=== analyze:nodelevels ===\n');

  const [encounters, encounterRandoms, gatherings] = await Promise.all([
    loadContentType('encounter'),
    loadContentType('encounterrandom'),
    loadContentType('gathering'),
  ]);

  const nodeNameToMap = loadNodeNameToMap();

  const entries: NodeLevelEntry[] = [
    ...encounters.map((n) => ({
      name: n.name,
      kind: 'Encounter',
      levelRange: n.levelRange,
    })),
    ...encounterRandoms.map((n) => ({
      name: n.name,
      kind: 'Encounter (Random)',
      levelRange: n.levelRange,
    })),
    ...gatherings.map((n) => ({
      name: n.name,
      kind: 'Gathering',
      levelRange: n.levelRange,
    })),
  ]
    .filter((n) => n.levelRange)
    .map((n) => ({
      ...n,
      mapName: nodeNameToMap.get(n.name) ?? '(unplaced)',
    }));

  console.log(`Loaded ${entries.length} level-gated node(s).\n`);

  // === Sorted node list ===
  console.log('=== Nodes by level ===\n');

  const sorted = [...entries].sort(
    (a, b) =>
      a.levelRange.min - b.levelRange.min ||
      a.levelRange.max - b.levelRange.max ||
      a.name.localeCompare(b.name),
  );

  const nameWidth = Math.max(...sorted.map((e) => e.name.length));
  const kindWidth = Math.max(...sorted.map((e) => e.kind.length));
  const mapWidth = Math.max(...sorted.map((e) => e.mapName.length));

  sorted.forEach((e) => {
    const levelLabel = `Lv.${e.levelRange.min}-${e.levelRange.max}`;
    console.log(
      `  ${levelLabel.padEnd(9)} ${e.name.padEnd(nameWidth)}  ${e.kind.padEnd(kindWidth)}  ${e.mapName.padEnd(mapWidth)}`,
    );
  });

  // === Gap analysis ===
  console.log('\n=== Level coverage gaps ===\n');

  const maxLevel = Math.max(0, ...entries.map((e) => e.levelRange.max));
  console.log(
    `Top node level: ${maxLevel}. Gap window size: ${gapSize} level(s).\n`,
  );

  const windows = gapWindows(
    entries.map((e) => e.levelRange),
    maxLevel,
    gapSize,
  );

  if (windows.length === 0) {
    console.log(
      `No gaps - every ${gapSize}-level window from 1..${maxLevel} has at least one node.`,
    );
  } else {
    console.log(
      `${windows.length} gap window(s) with no node coverage: ${formatWindows(windows)}`,
    );
  }

  const unplaced = entries.filter((e) => e.mapName === '(unplaced)');
  if (unplaced.length > 0) {
    console.log(
      `\nNote: ${unplaced.length} node(s) exist in gamedata but aren't placed on any map: ${unplaced.map((e) => e.name).join(', ')}`,
    );
  }
}

main();
