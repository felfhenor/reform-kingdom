/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { obtainabilitySources } from '@helpers/debug/analysis-obtainability-sources';

type Entry = any;
type ContentRef = { folder: string; name: string };

interface DemoManifest {
  maps: string[];
  stripFiles: string[];
  keep: string[];
  unobtainable: string[];
  cascade: string[];
  prune: Record<string, string[]>;
  orphans: string[];
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
    !manifest.unobtainable.includes(entry.name) &&
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

const sourceNames = (list: Array<{ folder: string; entry: Entry }>) => {
  const sources = obtainabilitySources((type) =>
    list.filter(({ folder }) => folder === type).map(({ entry }) => entry),
  );
  return new Set([
    ...sources.items,
    ...sources.equipment,
    ...sources.collectibles,
  ]);
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

  // Unobtainable content stays for whatever only names it, but nothing can be finished with it.
  const isUnavailable = (ref: ContentRef) =>
    isStrippedName(ref) || manifest.unobtainable.includes(ref.name);

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
  const lockedGates = gateNames.filter((name) =>
    isStrippedName({ folder: 'collectible', name }),
  );
  gateNames.forEach((name) => stripped.get('collectible')?.delete(name));

  const cascaded: string[] = [];
  // Removed only for naming an unobtainable item, so a source among them means that item shouldn't be listed.
  const unobtainableOnly: Array<{ folder: string; entry: Entry }> = [];
  let changed = true;
  while (changed) {
    changed = false;
    keptEntries()
      .filter(({ folder }) => manifest.cascade.includes(folder))
      .forEach(({ folder, entry }) => {
        const refs = refsOf(entry);
        const reason = cascadeReason(
          entry,
          refs,
          isUnavailable,
          manifest,
          nodeNames,
        );
        if (!reason) return;

        if (!cascadeReason(entry, refs, isStrippedName, manifest, nodeNames))
          unobtainableOnly.push({ folder, entry });
        markStripped(folder, entry);
        cascaded.push(`${folder} ${entry.name} (${reason})`);
        changed = true;
      });
  }

  const pruneStripped = () =>
    keptEntries().flatMap(({ folder, entry }) =>
      (manifest.prune[folder] ?? []).flatMap((field) => {
        // Wrapped in its field so a bare name list (e.g. trainerTeachingIds) still resolves.
        const elementRefs = (element: Entry) => refsOf({ [field]: [element] });
        const removed = (entry[field] ?? []).filter((element: Entry) =>
          elementRefs(element).some(isUnavailable),
        );
        const prunedLists = Object.fromEntries(
          manifest.prune[folder].map((list) => [list, []]),
        );
        removed
          .filter(
            (element: Entry) => !elementRefs(element).some(isStrippedName),
          )
          .forEach((element: Entry) =>
            unobtainableOnly.push({
              folder,
              entry: { ...entry, ...prunedLists, [field]: [element] },
            }),
          );
        if (removed.length > 0) {
          entry[field] = entry[field].filter(
            (element: Entry) => !removed.includes(element),
          );
        }
        return removed.map(
          (element: Entry) =>
            `${folder} ${entry.name} ${field}: ${elementRefs(element).find(isUnavailable)!.name}`,
        );
      }),
    );

  // Entries hidden behind a gate the demo never opens can't hand out what they reference.
  const isSealed = (entry: Entry) =>
    (entry.invisibleUntilCollectibleIdsFound ?? []).some((name: string) =>
      lockedGates.includes(name),
    );

  const stripOrphans = () => {
    const referenced = new Set(
      keptEntries()
        .filter(({ entry }) => !isSealed(entry))
        .flatMap(({ entry }) =>
          refsOf(entry).map((ref) => `${ref.folder}/${ref.name}`),
        ),
    );
    return keptEntries()
      .filter(
        ({ folder, entry }) =>
          manifest.orphans.includes(folder) &&
          ![...manifest.keep, ...manifest.pinned, ...gateNames].includes(
            entry.name,
          ) &&
          !referenced.has(`${folder}/${entry.name}`),
      )
      .map(({ folder, entry }) => {
        markStripped(folder, entry);
        return `${folder} ${entry.name}`;
      });
  };

  // Pruning can orphan more entries, and stripping orphans can make more list entries prunable.
  const pruned: string[] = [];
  const orphaned: string[] = [];
  let orphanCount = -1;
  while (orphanCount !== orphaned.length) {
    orphanCount = orphaned.length;
    pruned.push(...pruneStripped());
    orphaned.push(...stripOrphans());
  }

  const sealedNames = keptEntries()
    .filter(({ entry }) => isSealed(entry))
    .map(({ entry }) => entry.name);
  fs.writeJsonSync(DEMO_UNOBTAINABLE_FILE, [
    ...manifest.keep,
    ...manifest.unobtainable,
    ...gateNames,
    ...sealedNames,
  ]);

  // A source that also costs another unobtainable item was rightly removed.
  const lostSources = [
    ...sourceNames(
      unobtainableOnly.filter((source) =>
        refsOf(source.entry)
          .filter(isUnavailable)
          .every((ref) => sourceNames([source]).has(ref.name)),
      ),
    ),
  ].filter((name) => manifest.unobtainable.includes(name));
  const keptSources = sourceNames(
    keptEntries().filter(({ entry }) => !isSealed(entry)),
  );
  const openedGates = lockedGates.filter((name) => keptSources.has(name));

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
  printSection('Orphan-stripped (nothing kept produces them)', orphaned);
  printSection(
    'Warning: unobtainable items a stripped demo source produces (remove them from unobtainable)',
    lostSources,
  );
  printSection(
    'Warning: gates treated as locked that kept content awards',
    openedGates,
  );
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
