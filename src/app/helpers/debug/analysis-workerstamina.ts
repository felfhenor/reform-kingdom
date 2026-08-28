// Lists every gather node's one-way travel-tick cost from the Kingdom, for
// calibrating worker `stamina` stats against.

import { getEntriesByType } from '@helpers/content';
import { buildNodeNameToMap } from '@helpers/debug/analysis-utils';
import { travelPathTotalTicks } from '@helpers/hero/travel-cost';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  AnalysisTable,
  GatheringContent,
  WorkerStaminaCheckEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

export function runWorkerStaminaAnalysis(): AnalysisRunResult {
  const gatherings = getEntriesByType<GatheringContent>('gathering');
  const nodeNameToMap = buildNodeNameToMap();
  const kingdom = kingdomNodeGet();

  const entries: WorkerStaminaCheckEntry[] = gatherings.map((gathering) => {
    const path = kingdom ? travelPathFrom(kingdom, gathering.name) : undefined;
    const oneWayTicks =
      kingdom && path ? travelPathTotalTicks(path, kingdom) : undefined;

    return {
      name: gathering.name,
      mapName: nodeNameToMap.get(gathering.name) ?? '(unplaced)',
      oneWayTicks,
    };
  });

  const sorted = sortBy(entries, [
    (e: WorkerStaminaCheckEntry) => e.oneWayTicks ?? Number.MAX_SAFE_INTEGER,
    (e: WorkerStaminaCheckEntry) => e.name,
  ]);

  const table: AnalysisTable = {
    title: 'Gather node stamina distance',
    columns: ['Node', 'Map', 'Stamina Req'],
    rows: sorted.map((e) => ({
      Node: e.name,
      Map: e.mapName,
      'Stamina Req': e.oneWayTicks ?? 'unroutable',
    })),
  };

  const checks: AnalysisCheck[] = [];

  if (!kingdom) {
    checks.push({
      id: 'kingdom',
      label: 'Kingdom node',
      status: 'fail',
      message: 'No Kingdom node found on any map - cannot compute distances.',
    });
  }

  const unroutable = entries.filter((e) => e.oneWayTicks === undefined);
  if (kingdom && unroutable.length > 0) {
    checks.push({
      id: 'unroutable',
      label: 'Unroutable nodes',
      status: 'warning',
      message: `${unroutable.length} gather node(s) have no path from the Kingdom: ${unroutable
        .map((e) => e.name)
        .join(', ')}`,
    });
  } else if (kingdom) {
    checks.push({
      id: 'unroutable',
      label: 'Unroutable nodes',
      status: 'pass',
      message: 'Every gather node has a path from the Kingdom.',
    });
  }

  return {
    checks,
    tables: [table],
    summary: `${entries.length} gather node(s) measured.`,
  };
}
