/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs-extra';
import * as yaml from 'js-yaml';

type Entry = any;
type ContentRef = { folder: string; name: string };

interface DemoManifest {
  maps: string[];
  stripFiles: string[];
  keep: string[];
  cascade: string[];
  prune: Record<string, string[]>;
  pinned: string[];
}

// Outside the shipped json folder; validate:demo reads it to allow these to be unobtainable.
export const DEMO_UNOBTAINABLE_FILE = '.demo/expected-unobtainable.json';

export const demoManifest = (): DemoManifest =>
  yaml.load(fs.readFileSync('demo/manifest.yml', 'utf-8')) as DemoManifest;

const demoMapNodeNames = (maps: string[]): Set<string> =>
  new Set(
    maps.flatMap((map) =>
      fs
        .readJsonSync(`gamemaps/${map}.json`)
        .layers.flatMap((layer: any) => layer.objects ?? [])
        .map((object: any) => object.name),
    ),
  );

const fileIsStripped = (file: string, manifest: DemoManifest): boolean => {
  const normalized = file.replaceAll('\\', '/');
  return manifest.stripFiles.some((token) => normalized.includes(token));
};

// Region and node override entries belong to a map, so they follow the map allowlist without marking.
const entryIsStripped = (
  folder: string,
  entry: Entry,
  file: string,
  manifest: DemoManifest,
  nodeNames: Set<string>,
): boolean =>
  entry.demoStrip === true ||
  (!manifest.keep.includes(entry.name) &&
    (fileIsStripped(file, manifest) ||
      (folder === 'region' && !manifest.maps.includes(entry.mapName)) ||
      (folder === 'nodeoverride' && !nodeNames.has(entry.name))));

// Gate collectibles stay (unobtainable): hidden exits stay hidden, and tradeskill XP still banks at the cap.
const gateCollectibleNames = (
  kept: Array<{ folder: string; entry: Entry }>,
  refsOf: (entry: Entry) => ContentRef[],
): string[] =>
  kept.flatMap(({ folder, entry }) =>
    folder === 'tradeskilllevelrequirement'
      ? refsOf(entry)
          .filter((ref) => ref.folder === 'collectible')
          .map((ref) => ref.name)
      : (entry.invisibleUntilCollectibleIdsFound ?? []),
  );

const cascadeReason = (
  entry: Entry,
  refs: ContentRef[],
  isStrippedName: (ref: ContentRef) => boolean,
  manifest: DemoManifest,
  nodeNames: Set<string>,
): string | undefined => {
  if (entry.requireMapVisit && !manifest.maps.includes(entry.requireMapVisit))
    return `requires map ${entry.requireMapVisit}`;

  const missingNode = [
    ...JSON.stringify(entry).matchAll(/"nodeName":"([^"]+)"/g),
  ].find(([, nodeName]) => !nodeNames.has(nodeName));
  if (missingNode) return `node ${missingNode[1]}`;

  const ref = refs.find(isStrippedName);
  return ref ? `${ref.folder} ${ref.name}` : undefined;
};

const printSection = (title: string, lines: string[]) => {
  if (lines.length === 0) return;
  console.info(`\n[Demo] ${title} (${lines.length}):`);
  lines.sort().forEach((line) => console.info(`  ${line}`));
};

// Filters allData in place to the demo's content; exits when kept content still needs something stripped.
export const demoFilterContent = (
  allData: Record<string, Entry[]>,
  fileOf: Map<Entry, string>,
  refsOf: (entry: Entry) => ContentRef[],
): void => {
  const manifest = demoManifest();
  const nodeNames = demoMapNodeNames(manifest.maps);
  const stripped = new Map<string, Set<string>>();
  const markStripped = (folder: string, entry: Entry) => {
    if (!stripped.has(folder)) stripped.set(folder, new Set());
    stripped.get(folder)!.add(entry.name);
  };

  const isStrippedName = (ref: ContentRef) =>
    stripped.get(ref.folder)?.has(ref.name) ?? false;

  Object.entries(allData).forEach(([folder, entries]) =>
    entries
      .filter((entry) =>
        entryIsStripped(folder, entry, fileOf.get(entry)!, manifest, nodeNames),
      )
      .forEach((entry) => markStripped(folder, entry)),
  );

  const keptEntries = () =>
    Object.entries(allData).flatMap(([folder, entries]) =>
      entries
        .filter((entry) => !isStrippedName({ folder, name: entry.name }))
        .map((entry) => ({ folder, entry })),
    );

  const gateNames = gateCollectibleNames(keptEntries(), refsOf);
  gateNames.forEach((name) => stripped.get('collectible')?.delete(name));
  fs.writeJsonSync(DEMO_UNOBTAINABLE_FILE, [...manifest.keep, ...gateNames]);

  const cascaded: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    keptEntries()
      .filter(({ folder }) => manifest.cascade.includes(folder))
      .forEach(({ folder, entry }) => {
        const reason = cascadeReason(
          entry,
          refsOf(entry),
          isStrippedName,
          manifest,
          nodeNames,
        );
        if (!reason) return;

        markStripped(folder, entry);
        cascaded.push(`${folder} ${entry.name} (${reason})`);
        changed = true;
      });
  }

  const pruned = keptEntries().flatMap(({ folder, entry }) =>
    (manifest.prune[folder] ?? []).flatMap((field) => {
      const removed = (entry[field] ?? []).filter((element: Entry) =>
        refsOf(element).some(isStrippedName),
      );
      if (removed.length > 0) {
        entry[field] = entry[field].filter(
          (element: Entry) => !removed.includes(element),
        );
      }
      return removed.map(
        (element: Entry) =>
          `${folder} ${entry.name} ${field}: ${refsOf(element).find(isStrippedName)!.name}`,
      );
    }),
  );

  const dangling = keptEntries().flatMap(({ folder, entry }) =>
    refsOf(entry)
      .filter(isStrippedName)
      .map((ref) => `${folder} ${entry.name} -> ${ref.folder} ${ref.name}`),
  );

  const keptNames = new Set(keptEntries().map(({ entry }) => entry.name));
  const missingPinned = manifest.pinned.filter((name) => !keptNames.has(name));

  const keptTraderCategories = new Set(
    keptEntries()
      .filter(({ folder }) => folder === 'caravantrader')
      .map(({ entry }) => entry.category),
  );
  const emptyCaravanCategories = keptEntries()
    .filter(({ folder }) => folder === 'caravan')
    .flatMap(({ entry }) =>
      (entry.traderCategories ?? [])
        .filter((category: string) => !keptTraderCategories.has(category))
        .map((category: string) => `caravan ${entry.name} -> ${category}`),
    );

  const strippedCount = [...stripped.values()].reduce(
    (sum, names) => sum + names.size,
    0,
  );
  console.info(
    `[Demo] Keeping maps ${manifest.maps.join(', ')}; stripped ${strippedCount} entries.`,
  );
  printSection('Cascade-stripped (unfinishable in the demo)', cascaded);
  printSection('Pruned list entries', pruned);
  printSection('Kept content referencing stripped content', dangling);
  printSection('Pinned content that was stripped', missingPinned);
  printSection(
    'Caravan trader categories with no kept trader',
    emptyCaravanCategories,
  );

  if (
    dangling.length > 0 ||
    missingPinned.length > 0 ||
    emptyCaravanCategories.length > 0
  ) {
    console.error('\n[Demo] Fix the above by stripping or unmarking content.');
    process.exit(1);
  }

  Object.keys(allData).forEach((folder) => {
    allData[folder] = allData[folder].filter(
      (entry) => !isStrippedName({ folder, name: entry.name }),
    );
  });
};
