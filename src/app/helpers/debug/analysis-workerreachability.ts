// Bounds worker/node reachability by each worker's real leveling progression, not just raw stamina,
// both without outposts and with every outpost at +5 (the best case the player can build toward).

import { WORKER_MAX_LEVEL } from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import {
  buildNodeNameToMap,
  kingdomOneWayTicks,
} from '@helpers/debug/analysis-utils';
import {
  workerMinLevelForStamina,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import {
  type AnalysisCheck,
  type AnalysisRunResult,
  type AnalysisTable,
  type GatheringContent,
  type OutpostRouting,
  type TownContent,
  type WorkerContent,
  type WorkerLevelingGapEntry,
  type WorkerReachabilityCheckEntry,
  type WorkerReachabilityNode,
  type WorkerReachabilityProfile,
  type WorkerReachabilityScenario,
  type WorldNodeEntry,
} from '@interfaces';
import { minBy, sortBy } from 'es-toolkit/compat';

function buildNodes(
  nodeNameToMap: Map<string, string>,
  kingdom: WorldNodeEntry | undefined,
  allowTeleport: boolean,
  outpostRouting: OutpostRouting,
): WorkerReachabilityNode[] {
  return getEntriesByType<GatheringContent>('gathering').map((gathering) => ({
    nodeName: gathering.name,
    mapName: nodeNameToMap.get(gathering.name) ?? '(unplaced)',
    oneWayTicks: kingdomOneWayTicks(
      kingdom,
      gathering.name,
      allowTeleport,
      outpostRouting,
    ),
    levelRange: gathering.workerLevelRange,
  }));
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
    if (level < node.levelRange.min || level > node.levelRange.max)
      return false;
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

function buildScenario(
  worker: WorkerContent,
  nodeNameToMap: Map<string, string>,
  kingdom: WorldNodeEntry | undefined,
  outpostRouting: OutpostRouting,
): WorkerReachabilityScenario {
  const nodes = buildNodes(
    nodeNameToMap,
    kingdom,
    worker.canUseTeleports,
    outpostRouting,
  );
  return { nodes, cap: achievableLevelCap(worker, nodes) };
}

function buildProfile(
  worker: WorkerContent,
  nodeNameToMap: Map<string, string>,
  kingdom: WorldNodeEntry | undefined,
): WorkerReachabilityProfile {
  return {
    worker,
    base: buildScenario(worker, nodeNameToMap, kingdom, 'None'),
    outposts: buildScenario(worker, nodeNameToMap, kingdom, 'AllMaxed'),
  };
}

function reachableAtLevel(
  worker: WorkerContent,
  cap: number,
  oneWayTicks?: number,
): number | undefined {
  if (oneWayTicks === undefined) return undefined;

  const level = workerMinLevelForStamina(worker, oneWayTicks);
  return level !== undefined && level <= cap ? level : undefined;
}

function buildReachabilityEntries(
  profiles: WorkerReachabilityProfile[],
): WorkerReachabilityCheckEntry[] {
  return profiles.flatMap(({ worker, base, outposts }) =>
    base.nodes.map((node, index) => {
      const outpostOneWayTicks = outposts.nodes[index]?.oneWayTicks;

      return {
        workerName: worker.name,
        nodeName: node.nodeName,
        mapName: node.mapName,
        oneWayTicks: node.oneWayTicks,
        reachableAtLevel: reachableAtLevel(worker, base.cap, node.oneWayTicks),
        outpostOneWayTicks,
        outpostReachableAtLevel: reachableAtLevel(
          worker,
          outposts.cap,
          outpostOneWayTicks,
        ),
        levelRange: node.levelRange,
      };
    }),
  );
}

// Cheapest node covering `level` - the concrete reason a worker stuck at `level` can't progress.
function findBlockingNode(
  nodes: WorkerReachabilityNode[],
  level: number,
): WorkerReachabilityNode | undefined {
  const candidates = nodes.filter(
    (node) => level >= node.levelRange.min && level <= node.levelRange.max,
  );
  return minBy(
    candidates,
    (node) => node.oneWayTicks ?? Number.MAX_SAFE_INTEGER,
  );
}

function buildLevelingGapEntries(
  profiles: WorkerReachabilityProfile[],
  scenarioKey: 'base' | 'outposts',
  idealCap: number,
): WorkerLevelingGapEntry[] {
  return profiles
    .filter((profile) => profile[scenarioKey].cap < idealCap)
    .map((profile) => {
      const { nodes, cap: stuckAtLevel } = profile[scenarioKey];
      const blockingNode = findBlockingNode(nodes, stuckAtLevel);

      return {
        workerName: profile.worker.name,
        stuckAtLevel,
        blockingNodeName: blockingNode?.nodeName,
        blockingNodeLevelRange: blockingNode?.levelRange,
        workerStaminaAtStuckLevel: workerStatsForLevel(
          profile.worker,
          stuckAtLevel,
        ).stamina,
        blockingNodeStaminaCost: blockingNode?.oneWayTicks,
      };
    });
}

function nodeNamesWhere(
  nodes: WorkerReachabilityNode[],
  entries: WorkerReachabilityCheckEntry[],
  predicate: (nodeEntries: WorkerReachabilityCheckEntry[]) => boolean,
): string[] {
  return nodes
    .filter((node) =>
      predicate(entries.filter((e) => e.nodeName === node.nodeName)),
    )
    .map((node) => node.nodeName);
}

function nodeReachabilityCheck(
  nodes: WorkerReachabilityNode[],
  entries: WorkerReachabilityCheckEntry[],
): AnalysisCheck {
  const unreachable = nodeNamesWhere(nodes, entries, (nodeEntries) =>
    nodeEntries.every((e) => e.outpostReachableAtLevel === undefined),
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
    message: `${unreachable.length} node(s) are unreachable by every worker, even with every outpost at +5: ${unreachable.join(', ')}`,
  };
}

function outpostOnlyNodesCheck(
  nodes: WorkerReachabilityNode[],
  entries: WorkerReachabilityCheckEntry[],
): AnalysisCheck {
  const outpostOnly = nodeNamesWhere(
    nodes,
    entries,
    (nodeEntries) =>
      nodeEntries.every((e) => e.reachableAtLevel === undefined) &&
      nodeEntries.some((e) => e.outpostReachableAtLevel !== undefined),
  );

  return {
    id: 'outpost-only-nodes',
    label: 'Outpost-dependent nodes',
    status: outpostOnly.length === 0 ? 'pass' : 'info',
    message:
      outpostOnly.length === 0
        ? 'No gather node needs outposts to be reachable by a worker.'
        : `${outpostOnly.length} node(s) are only reachable by workers once outposts are at +5: ${outpostOnly.join(', ')}`,
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
      message: `Every worker can level all the way to the content-wide cap (Lv. ${idealCap}), given every outpost at +5.`,
    };
  }

  return {
    id: 'leveling-gaps',
    label: 'Worker leveling coverage',
    status: 'warning',
    message: `${gaps.length} worker(s) stall before the content-wide level cap (Lv. ${idealCap}) even with every outpost at +5 - see the leveling gaps tables: ${gaps
      .map((gap) => `${gap.workerName} (stuck at Lv.${gap.stuckAtLevel})`)
      .join(', ')}`,
  };
}

function outpostLevelingCheck(
  profiles: WorkerReachabilityProfile[],
): AnalysisCheck {
  const boosted = profiles.filter(
    (profile) => profile.outposts.cap > profile.base.cap,
  );

  return {
    id: 'outpost-leveling',
    label: 'Outpost-dependent leveling',
    status: boosted.length === 0 ? 'pass' : 'info',
    message:
      boosted.length === 0
        ? 'No worker levels any higher with outposts than without.'
        : `${boosted.length} worker(s) level higher once outposts are at +5: ${boosted
            .map(
              ({ worker, base, outposts }) =>
                `${worker.name} (Lv.${base.cap} -> Lv.${outposts.cap})`,
            )
            .join(', ')}`,
  };
}

function reachabilityTable(
  entries: WorkerReachabilityCheckEntry[],
): AnalysisTable {
  return {
    title: 'Worker node reachability',
    columns: [
      'Worker',
      'Node',
      'Map',
      'Stamina Req',
      'Reachable At',
      'Stamina Req (+5 Outposts)',
      'Reachable At (+5 Outposts)',
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
      'Stamina Req (+5 Outposts)': e.outpostOneWayTicks ?? 'unroutable',
      'Reachable At (+5 Outposts)': e.outpostReachableAtLevel ?? 'never',
      'Node Level Window': `${e.levelRange.min}-${e.levelRange.max}`,
    })),
  };
}

function levelingGapsTable(
  title: string,
  gaps: WorkerLevelingGapEntry[],
): AnalysisTable {
  return {
    title,
    columns: [
      'Worker',
      'Stuck At',
      'Blocking Node',
      'Blocking Node Window',
      'Worker Stamina',
      'Node Stamina Req',
    ],
    rows: sortBy(gaps, (g: WorkerLevelingGapEntry) => g.workerName).map(
      (g) => ({
        Worker: g.workerName,
        'Stuck At': g.stuckAtLevel,
        'Blocking Node': g.blockingNodeName ?? '(none)',
        'Blocking Node Window': g.blockingNodeLevelRange
          ? `${g.blockingNodeLevelRange.min}-${g.blockingNodeLevelRange.max}`
          : '-',
        'Worker Stamina': g.workerStaminaAtStuckLevel,
        'Node Stamina Req': g.blockingNodeStaminaCost ?? 'unroutable',
      }),
    ),
  };
}

export function runWorkerReachabilityAnalysis(): AnalysisRunResult {
  const towns = getEntriesByType<TownContent>('town');
  const allWorkers = getEntriesByType<WorkerContent>('worker');
  const nodeNameToMap = buildNodeNameToMap();
  const kingdom = kingdomNodeGet();

  const workers = allWorkers.filter(
    (w) =>
      !towns.some((t) =>
        t.gathering.workers.find((tw) => tw.workerId === w.id),
      ),
  );

  const profiles = workers.map((worker) =>
    buildProfile(worker, nodeNameToMap, kingdom),
  );
  const contentNodes = buildNodes(nodeNameToMap, kingdom, true, 'None');
  const idealCap = achievableLevelCap(undefined, contentNodes, true);

  const entries = buildReachabilityEntries(profiles);
  const baseGaps = buildLevelingGapEntries(profiles, 'base', idealCap);
  const outpostGaps = buildLevelingGapEntries(profiles, 'outposts', idealCap);

  const checks: AnalysisCheck[] = [
    nodeReachabilityCheck(contentNodes, entries),
    outpostOnlyNodesCheck(contentNodes, entries),
    levelingGapCheck(outpostGaps, idealCap),
    outpostLevelingCheck(profiles),
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
    tables: [
      reachabilityTable(entries),
      levelingGapsTable('Worker leveling gaps (no outposts)', baseGaps),
      levelingGapsTable('Worker leveling gaps (+5 outposts)', outpostGaps),
    ],
    summary: `${entries.length} worker/node pair(s) checked across ${workers.length} worker(s) and ${contentNodes.length} node(s); content-wide leveling cap is Lv. ${idealCap}.`,
  };
}
