import { getEntriesByType } from '@helpers/content/content';
import { allMaps } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisIssue,
  AnalysisLevelWindow,
  AnalysisParams,
  BaseStat,
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  StatBlock,
  TiledMap,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

const NODE_LAYER_NAMES = ['Explore Nodes'];

// The `level` param if given, else the highest level any world node spans.
export function resolveMaxContentLevel(params: AnalysisParams): number {
  if (params['level'] !== undefined) return Number(params['level']);

  const nodes = [
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
    ...getEntriesByType<GatheringContent>('gathering'),
  ];
  return Math.max(
    0,
    ...nodes
      .map((n) => n.levelRange)
      .filter(Boolean)
      .map((r) => r.max),
  );
}

// Node name -> map name, from every map's Explore Nodes Tiled layer.
// Shared by analyses that need to place a content entry (by its `name`,
// which doubles as the node name) on a specific map.
export function buildNodeNameToMap(): Map<string, string> {
  const nodeNameToMap = new Map<string, string>();

  allMaps().forEach((gameMap) => {
    const map = gameMap.data as TiledMap;
    const nodes = (map.layers ?? [])
      .filter((layer) => NODE_LAYER_NAMES.includes(layer.name))
      .flatMap((layer) => layer.objects ?? []);

    nodes.forEach((node) => nodeNameToMap.set(node.name, gameMap.name));
  });

  return nodeNameToMap;
}

const STATS: BaseStat[] = [
  'Intelligence',
  'Strength',
  'Vitality',
  'Resistance',
  'Agility',
  'Health',
  'Energy',
  'Luck',
];

// Fixed-size [start, end] windows from 1 to `maxLevel`, flagging any window
// that none of `levels` falls inside.
export function gapWindows(
  levels: number[],
  maxLevel: number,
  gapSize: number,
): AnalysisLevelWindow[] {
  const windows: AnalysisLevelWindow[] = [];
  for (let start = 1; start <= maxLevel; start += gapSize) {
    const end = Math.min(start + gapSize - 1, maxLevel);
    const covered = levels.some((level) => level >= start && level <= end);
    if (!covered) windows.push({ start, end });
  }
  return windows;
}

// Same idea as `gapWindows`, but for entries that span a range rather than
// a single level - a window counts as covered if any range overlaps it.
export function gapWindowsForRanges(
  ranges: { min: number; max: number }[],
  maxLevel: number,
  gapSize: number,
): AnalysisLevelWindow[] {
  const windows: AnalysisLevelWindow[] = [];
  for (let start = 1; start <= maxLevel; start += gapSize) {
    const end = Math.min(start + gapSize - 1, maxLevel);
    const covered = ranges.some((r) => r.min <= end && r.max >= start);
    if (!covered) windows.push({ start, end });
  }
  return windows;
}

export function formatWindows(windows: AnalysisLevelWindow[]): string {
  return windows
    .map((w) => (w.start === w.end ? `${w.start}` : `${w.start}-${w.end}`))
    .join(', ');
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function zeroStats(): StatBlock {
  const stats = {} as StatBlock;
  STATS.forEach((stat) => {
    stats[stat] = 0;
  });
  return stats;
}

export function statSum(stats: Partial<StatBlock>): number {
  return sumBy(STATS, (stat) => stats[stat] ?? 0);
}

export function addStats(target: StatBlock, source: Partial<StatBlock>): void {
  STATS.forEach((stat) => {
    target[stat] += source[stat] ?? 0;
  });
}

// Case-insensitive filter by `name` - returns every item if `names` is
// empty/omitted.
export function filterByNames<T extends { name: string }>(
  items: T[],
  names?: string[],
): T[] {
  if (!names || names.length === 0) return items;

  const wanted = names.map((name) => name.trim().toLowerCase());
  return items.filter((item) => wanted.includes(item.name.toLowerCase()));
}

export { STATS as BASE_STATS };

export function analysisFail(message: string): AnalysisIssue {
  return { status: 'fail', message };
}

export function analysisWarn(message: string): AnalysisIssue {
  return { status: 'warning', message };
}

export function analysisIssueCheck(
  id: string,
  label: string,
  issue: AnalysisIssue,
): AnalysisCheck {
  return {
    id,
    label,
    status: issue.status,
    message: `${label}: ${issue.message}`,
  };
}

// One check per issue, or a single passing check when there are none.
export function analysisIssueChecks(
  idPrefix: string,
  label: string,
  issues: AnalysisIssue[],
  passMessage: string,
): AnalysisCheck[] {
  if (issues.length === 0) {
    return [
      { id: `${idPrefix}:ok`, label, status: 'pass', message: passMessage },
    ];
  }

  return issues.map((issue, i) =>
    analysisIssueCheck(`${idPrefix}:${i}`, label, issue),
  );
}
