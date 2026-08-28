// Bounds worker/node reachability by each worker's real leveling progression, not just raw stamina.

import { getEntriesByType } from '@helpers/content';
import { buildNodeNameToMap } from '@helpers/debug/analysis-utils';
import { travelPathTotalTicks } from '@helpers/hero/travel-cost';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding';
import {
  WORKER_MAX_LEVEL,
  workerMinLevelForStamina,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  AnalysisTable,
  GatheringContent,
  WorkerContent,
  WorkerLevelingGapEntry,
  WorkerReachabilityCheckEntry,
  WorkerReachabilityNode,
} from '@interfaces';
import { minBy, sortBy } from 'es-toolkit/compat';

function buildNodes(nodeNameToMap: Map<string, string>): WorkerReachabilityNode[] {
  const kingdom = kingdomNodeGet();
  const gatherings = getEntriesByType<GatheringContent>('gathering');

  return gatherings.map((gathering) => {
    const path = kingdom ? travelPathFrom(kingdom, gathering.name) : undefined;
    return {
      nodeName: gathering.name,
      mapName: nodeNameToMap.get(gathering.name) ?? '(unplaced)',
      oneWayTicks:
        kingdom && path ? travelPathTotalTicks(path, kingdom) : undefined,
      levelRange: gathering.workerLevelRange,
    };
  });
}

// True if a node's window covers `level` and (unless `ignoreStamina`) is reachable there.
function levelIsCovered(
  worker: WorkerContent | undefined,
  nodes: WorkerReachabilityNode[],
  level: number,
  ignoreStamina: boolean,
): boolean {
  const stamina = worker ? workerStatsForLevel(worker, level).stamina : 0;

  return nodes.some((node) => {
    if (level < node.levelRange.min || level > node.levelRange.max) return false;
    if (ignoreStamina) return true;
    return node.oneWayTicks !== undefined && node.oneWayTicks <= stamina;
  });
}

// The level a worker gets permanently stuck at - the first level with no covering, reachable node.
// `worker: undefined, ignoreStamina: true` gives the content-wide ideal cap (no worker involved).
function achievableLevelCap(
  worker: WorkerContent | undefined,
  nodes: WorkerReachabilityNode[],
  ignoreStamina = false,
): number {
  let level = 1;
  while (
    level < WORKER_MAX_LEVEL &&
    levelIsCovered(worker, nodes, level, ignoreStamina)
  ) {
    level++;
  }
  return level;
}

function buildReachabilityEntries(
  workers: WorkerContent[],
  nodes: WorkerReachabilityNode[],
  caps: Map<string, number>,
): WorkerReachabilityCheckEntry[] {
  return workers.flatMap((worker) => {
    const cap = caps.get(worker.id) ?? 1;

    return nodes.map((node) => {
      const rawReachableAtLevel =
        node.oneWayTicks !== undefined
          ? workerMinLevelForStamina(worker, node.oneWayTicks)
          : undefined;
      const reachableAtLevel =
        rawReachableAtLevel !== undefined && rawReachableAtLevel <= cap
          ? rawReachableAtLevel
          : undefined;

      return {
        workerName: worker.name,
        nodeName: node.nodeName,
        mapName: node.mapName,
        oneWayTicks: node.oneWayTicks,
        reachableAtLevel,
        levelRange: node.levelRange,
      };
    });
  });
}

// Cheapest node covering `level` - the concrete reason a worker stuck at `level` can't progress.
function findBlockingNode(
  nodes: WorkerReachabilityNode[],
  level: number,
): WorkerReachabilityNode | undefined {
  const candidates = nodes.filter(
    (node) => level >= node.levelRange.min && level <= node.levelRange.max,
  );
  return minBy(candidates, (node) => node.oneWayTicks ?? Number.MAX_SAFE_INTEGER);
}

function buildLevelingGapEntries(
  workers: WorkerContent[],
  nodes: WorkerReachabilityNode[],
  caps: Map<string, number>,
  idealCap: number,
): WorkerLevelingGapEntry[] {
  return workers
    .filter((worker) => (caps.get(worker.id) ?? 1) < idealCap)
    .map((worker) => {
      const stuckAtLevel = caps.get(worker.id) ?? 1;
      const blockingNode = findBlockingNode(nodes, stuckAtLevel);

      return {
        workerName: worker.name,
        stuckAtLevel,
        blockingNodeName: blockingNode?.nodeName,
        blockingNodeLevelRange: blockingNode?.levelRange,
        workerStaminaAtStuckLevel: workerStatsForLevel(worker, stuckAtLevel)
          .stamina,
        blockingNodeStaminaCost: blockingNode?.oneWayTicks,
      };
    });
}

function nodeReachabilityCheck(
  nodes: WorkerReachabilityNode[],
  entries: WorkerReachabilityCheckEntry[],
): AnalysisCheck {
  const unreachable = nodes.filter(
    (node) =>
      !entries.some(
        (e) => e.nodeName === node.nodeName && e.reachableAtLevel !== undefined,
      ),
  );

  if (unreachable.length === 0) {
    return {
      id: 'unreachable',
      label: 'Node reachability',
      status: 'pass',
      message: 'Every gather node is reachable by at least one worker.',
    };
  }

  return {
    id: 'unreachable',
    label: 'Node reachability',
    status: 'fail',
    message: `${unreachable.length} node(s) are unreachable by every worker: ${unreachable
      .map((node) => node.nodeName)
      .join(', ')}`,
  };
}

function levelingGapCheck(
  gaps: WorkerLevelingGapEntry[],
  idealCap: number,
): AnalysisCheck {
  if (gaps.length === 0) {
    return {
      id: 'leveling-gaps',
      label: 'Worker leveling coverage',
      status: 'pass',
      message: `Every worker can level all the way to the content-wide cap (Lv. ${idealCap}).`,
    };
  }

  return {
    id: 'leveling-gaps',
    label: 'Worker leveling coverage',
    status: 'warning',
    message: `${gaps.length} worker(s) stall before the content-wide level cap (Lv. ${idealCap}) - see the leveling gaps table: ${gaps
      .map((gap) => `${gap.workerName} (stuck at Lv.${gap.stuckAtLevel})`)
      .join(', ')}`,
  };
}

export function runWorkerReachabilityAnalysis(): AnalysisRunResult {
  const workers = getEntriesByType<WorkerContent>('worker');
  const nodeNameToMap = buildNodeNameToMap();
  const nodes = buildNodes(nodeNameToMap);
  const kingdom = kingdomNodeGet();

  const caps = new Map(
    workers.map((worker) => [worker.id, achievableLevelCap(worker, nodes)]),
  );
  const idealCap = achievableLevelCap(undefined, nodes, true);

  const entries = buildReachabilityEntries(workers, nodes, caps);
  const gaps = buildLevelingGapEntries(workers, nodes, caps, idealCap);

  const reachabilityTable: AnalysisTable = {
    title: 'Worker node reachability',
    columns: [
      'Worker',
      'Node',
      'Map',
      'Stamina Req',
      'Reachable At',
      'Node Level Window',
    ],
    rows: sortBy(entries, [
      (e: WorkerReachabilityCheckEntry) => e.workerName,
      (e: WorkerReachabilityCheckEntry) => e.nodeName,
    ]).map((e) => ({
      Worker: e.workerName,
      Node: e.nodeName,
      Map: e.mapName,
      'Stamina Req': e.oneWayTicks ?? 'unroutable',
      'Reachable At': e.reachableAtLevel ?? 'never',
      'Node Level Window': `${e.levelRange.min}-${e.levelRange.max}`,
    })),
  };

  const levelingGapsTable: AnalysisTable = {
    title: 'Worker leveling gaps',
    columns: [
      'Worker',
      'Stuck At',
      'Blocking Node',
      'Blocking Node Window',
      'Worker Stamina',
      'Node Stamina Req',
    ],
    rows: sortBy(gaps, (g: WorkerLevelingGapEntry) => g.workerName).map((g) => ({
      Worker: g.workerName,
      'Stuck At': g.stuckAtLevel,
      'Blocking Node': g.blockingNodeName ?? '(none)',
      'Blocking Node Window': g.blockingNodeLevelRange
        ? `${g.blockingNodeLevelRange.min}-${g.blockingNodeLevelRange.max}`
        : '-',
      'Worker Stamina': g.workerStaminaAtStuckLevel,
      'Node Stamina Req': g.blockingNodeStaminaCost ?? 'unroutable',
    })),
  };

  const checks: AnalysisCheck[] = [
    nodeReachabilityCheck(nodes, entries),
    levelingGapCheck(gaps, idealCap),
  ];

  if (!kingdom) {
    checks.unshift({
      id: 'kingdom',
      label: 'Kingdom node',
      status: 'fail',
      message: 'No Kingdom node found on any map - cannot compute distances.',
    });
  }

  return {
    checks,
    tables: [reachabilityTable, levelingGapsTable],
    summary: `${entries.length} worker/node pair(s) checked across ${workers.length} worker(s) and ${nodes.length} node(s); content-wide leveling cap is Lv. ${idealCap}.`,
  };
}
