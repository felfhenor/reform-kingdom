// Validates every item/collectible/equipment is obtainable (dropped,
// rewarded, gathered, crafted, traded, exchanged) or marked `unobtainable: true`.

import { getEntriesByType } from '@helpers/content/content';
import { obtainabilitySources } from '@helpers/debug/analysis-obtainability-sources';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CollectibleContent,
  EquipmentContent,
  ItemContent,
  WorkerContent,
} from '@interfaces';

// Granted unconditionally by game code.
const GUARANTEED_GRANT_NAMES = new Set<string>(['Founding Stone']);

function checkCandidates(
  kind: string,
  candidates: { id: string; name: string; unobtainable?: boolean }[],
  obtainableIds: Set<string>,
): AnalysisCheck[] {
  return candidates.map((candidate) => {
    const id = `obtainability:${kind}:${candidate.id}`;

    if (candidate.unobtainable) {
      return {
        id,
        label: candidate.name,
        status: 'info' as const,
        message: `"${candidate.name}" [${kind}] is marked unobtainable - skipped.`,
      };
    }

    if (GUARANTEED_GRANT_NAMES.has(candidate.name)) {
      return {
        id,
        label: candidate.name,
        status: 'pass' as const,
        message: `"${candidate.name}" [${kind}] is a guaranteed starting grant.`,
      };
    }

    if (obtainableIds.has(candidate.id)) {
      return {
        id,
        label: candidate.name,
        status: 'pass' as const,
        message: `"${candidate.name}" [${kind}] is obtainable.`,
      };
    }

    return {
      id,
      label: candidate.name,
      status: 'fail' as const,
      message: `${kind} "${candidate.name}" has no drop, completion or task reward, gather result, recipe result, or exchange that produces it, and is not marked "unobtainable: true".`,
    };
  });
}

export function runObtainabilityAnalysis(): AnalysisRunResult {
  const sources = obtainabilitySources(getEntriesByType);

  const checks: AnalysisCheck[] = [
    ...checkCandidates(
      'Item',
      getEntriesByType<ItemContent>('item'),
      sources.items,
    ),
    ...checkCandidates(
      'Collectible',
      getEntriesByType<CollectibleContent>('collectible'),
      sources.collectibles,
    ),
    ...checkCandidates(
      'Equipment',
      getEntriesByType<EquipmentContent>('equipment'),
      sources.equipment,
    ),
    ...checkCandidates(
      'Worker',
      getEntriesByType<WorkerContent>('worker'),
      sources.workers,
    ),
  ];

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every item/collectible/equipment is either obtainable or marked unobtainable.'
        : `${failures} entrie(s) have no way to be obtained.`,
  };
}
