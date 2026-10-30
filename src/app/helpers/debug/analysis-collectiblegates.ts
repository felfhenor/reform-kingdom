/**
 * Validates CollectibleGate content: each gate is placed on a map as a
 * CollectibleGate node, and every required collectible exists, is
 * obtainable (a node source must be placed on a map), and is listed once. Also warns about explore/mystical node
 * collectibles that no gate asks for.
 */

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { getCollectibleSource } from '@helpers/item/collectible-source';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CollectibleContent,
  CollectibleGateContent,
  CollectibleId,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

function requiredCollectibleProblem(
  collectibleId: CollectibleId,
): string | undefined {
  const collectible = getEntry<CollectibleContent>(collectibleId);
  if (!collectible) return `"${collectibleId}" is not a collectible`;
  if (collectible.unobtainable) return `"${collectible.name}" is unobtainable`;
  const source = getCollectibleSource(collectibleId);
  if (!source) return `"${collectible.name}" has no source`;
  if (source.type === 'node' && !worldNodeByName(source.name)) {
    return `"${collectible.name}" drops from "${source.name}", which is not placed on any map`;
  }
  return undefined;
}

function gateProblems(gate: CollectibleGateContent): string[] {
  const node = worldNodeByName(gate.name);
  const placementProblem = !node
    ? 'is not placed on any map'
    : node.nodeData.type !== 'CollectibleGate'
      ? `is placed as a "${node.nodeData.type}" node, not "CollectibleGate"`
      : undefined;

  const requiredIds = gate.requiredCollectibleIds;
  const duplicateCount = requiredIds.length - uniq(requiredIds).length;

  return [
    placementProblem,
    requiredIds.length === 0 ? 'requires no collectibles' : undefined,
    duplicateCount > 0
      ? `lists ${duplicateCount} collectible(s) more than once`
      : undefined,
    ...requiredIds.map(requiredCollectibleProblem),
  ].filter((problem): problem is string => !!problem);
}

function checkGate(gate: CollectibleGateContent): AnalysisCheck {
  const problems = gateProblems(gate);
  const id = `collectiblegates:${gate.id}`;

  return problems.length > 0
    ? {
        id,
        label: gate.name,
        status: 'fail',
        message: `${gate.name}: ${problems.join('; ')}.`,
      }
    : {
        id,
        label: gate.name,
        status: 'pass',
        message: `${gate.name} is placed and requires ${gate.requiredCollectibleIds.length} obtainable collectible(s).`,
      };
}

// Explore and mystical (random explore) node collectibles are meant to open a gate; trader/crafting/raid ones are optional.
function checkNodeCollectiblesGated(
  gates: CollectibleGateContent[],
): AnalysisCheck {
  const gatedIds = new Set(
    gates.flatMap((gate) => gate.requiredCollectibleIds),
  );
  const ungated = getEntriesByType<CollectibleContent>('collectible').filter(
    (collectible) =>
      getCollectibleSource(collectible.id)?.type === 'node' &&
      !gatedIds.has(collectible.id),
  );

  return ungated.length > 0
    ? {
        id: 'collectiblegates:ungated',
        label: 'Ungated node collectibles',
        status: 'warning',
        message: `${ungated.length} explore node collectible(s) aren't required by any collectible gate: ${ungated.map((c) => c.name).join(', ')}.`,
      }
    : {
        id: 'collectiblegates:ungated',
        label: 'Ungated node collectibles',
        status: 'pass',
        message:
          'Every explore node collectible is required by a collectible gate.',
      };
}

export function runCollectibleGatesAnalysis(): AnalysisRunResult {
  const gates = getEntriesByType<CollectibleGateContent>('collectiblegate');
  const checks = [...gates.map(checkGate), checkNodeCollectiblesGated(gates)];
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every collectible gate (${gates.length} checked) is placed and requires only obtainable collectibles.`
        : `${failures} of ${gates.length} collectible gate(s) have a placement or requirement problem.`,
  };
}
