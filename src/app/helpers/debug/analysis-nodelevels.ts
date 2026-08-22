/**
 * Lists every level-gated world node (encounter, random encounter,
 * gathering) sorted by level, alongside the map it's placed on, then flags
 * level windows with no node covering them. Ported from
 * `scripts/analyze-nodelevels.ts`.
 */

import { sortBy } from 'es-toolkit/compat';
import { getEntriesByType } from '@helpers/content';
import { formatWindows, gapWindowsForRanges } from '@helpers/debug/analysis-utils';
import { allMaps } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisParams,
  AnalysisRunResult,
  AnalysisTable,
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  NodeLevelCheckEntry,
  TiledMap,
} from '@interfaces';

const NODE_LAYER_NAMES = ['Explore Nodes', 'Other Nodes'];

function buildNodeNameToMap(): Map<string, string> {
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

export function runNodeLevelsAnalysis(params: AnalysisParams): AnalysisRunResult {
  const gapSize = Number(params['gap'] ?? 4);
  if (!Number.isInteger(gapSize) || gapSize < 1) {
    throw new Error(`"gap" must be a positive integer, got ${params['gap']}.`);
  }

  const encounters = getEntriesByType<EncounterContent>('encounter');
  const encounterRandoms = getEntriesByType<EncounterRandomContent>('encounterrandom');
  const gatherings = getEntriesByType<GatheringContent>('gathering');

  const nodeNameToMap = buildNodeNameToMap();

  const entries: NodeLevelCheckEntry[] = [
    ...encounters.map((n) => ({ name: n.name, kind: 'Encounter', levelRange: n.levelRange })),
    ...encounterRandoms.map((n) => ({
      name: n.name,
      kind: 'Encounter (Random)',
      levelRange: n.levelRange,
    })),
    ...gatherings.map((n) => ({ name: n.name, kind: 'Gathering', levelRange: n.levelRange })),
  ]
    .filter((n) => n.levelRange)
    .map((n) => ({ ...n, mapName: nodeNameToMap.get(n.name) ?? '(unplaced)' }));

  const sorted = sortBy(entries, [
    (e: NodeLevelCheckEntry) => e.levelRange.min,
    (e: NodeLevelCheckEntry) => e.levelRange.max,
    (e: NodeLevelCheckEntry) => e.name,
  ]);

  const table: AnalysisTable = {
    title: 'Level-gated nodes',
    columns: ['Level', 'Name', 'Kind', 'Map'],
    rows: sorted.map((e) => ({
      Level: `${e.levelRange.min}-${e.levelRange.max}`,
      Name: e.name,
      Kind: e.kind,
      Map: e.mapName,
    })),
  };

  const maxLevel = Math.max(0, ...entries.map((e) => e.levelRange.max));
  const windows = gapWindowsForRanges(
    entries.map((e) => e.levelRange),
    maxLevel,
    gapSize,
  );

  const checks: AnalysisCheck[] = [
    windows.length === 0
      ? {
          id: 'coverage',
          label: 'Level coverage',
          status: 'pass',
          message: `Every ${gapSize}-level window from 1..${maxLevel} has at least one node.`,
        }
      : {
          id: 'coverage',
          label: 'Level coverage',
          status: 'warning',
          message: `${windows.length} gap window(s) with no node coverage: ${formatWindows(windows)}`,
        },
  ];

  const unplaced = entries.filter((e) => e.mapName === '(unplaced)');
  if (unplaced.length > 0) {
    checks.push({
      id: 'unplaced',
      label: 'Unplaced nodes',
      status: 'warning',
      message: `${unplaced.length} node(s) exist in gamedata but aren't placed on any map: ${unplaced.map((e) => e.name).join(', ')}`,
    });
  }

  const warnings = checks.filter((c) => c.status === 'warning').length;

  return {
    checks,
    tables: [table],
    summary:
      warnings === 0
        ? `No coverage gaps found across ${entries.length} node(s).`
        : `${warnings} coverage gap warning(s) found across ${entries.length} node(s).`,
  };
}
