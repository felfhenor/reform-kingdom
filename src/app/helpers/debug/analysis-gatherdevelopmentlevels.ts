/**
 * Validates that every GatherNode's development level (0..maxLevel-1, see
 * `helpers/world-node/world-node-level.ts`) has at least one gatherResults
 * entry available at that level - either an unrestricted result (no
 * levelRequirement) or one whose levelRequirement matches exactly. A level
 * with zero matching results would gather nothing once a node reaches it.
 * Mirrors `gatheringResultsAtLevel` in `helpers/world-node/world-node-gathering.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  GatheringContent,
} from '@interfaces';

function checkGathering(gathering: GatheringContent): AnalysisCheck {
  const gapLevels: number[] = [];
  for (let level = 0; level < gathering.maxLevel; level += 1) {
    if (gatheringResultsAtLevel(gathering, level).length === 0) {
      gapLevels.push(level);
    }
  }

  if (gapLevels.length > 0) {
    return {
      id: `gatherdevelopmentlevels:${gathering.id}`,
      label: gathering.name,
      status: 'fail',
      message: `${gathering.name} has no gatherResults available at level(s) ${gapLevels.join(', ')} (checked 0..${gathering.maxLevel - 1}) - gathering there would yield nothing once developed to that level.`,
    };
  }

  return {
    id: `gatherdevelopmentlevels:${gathering.id}`,
    label: gathering.name,
    status: 'pass',
    message: `${gathering.name}: every level 0..${gathering.maxLevel - 1} has at least one available gatherResults entry.`,
  };
}

export function runGatherDevelopmentLevelsAnalysis(): AnalysisRunResult {
  const gatherings = getEntriesByType<GatheringContent>('gathering');

  const checks = gatherings.map(checkGathering);
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every gather node has at least one available result at each of its development levels.'
        : `${failures} gather node(s) have a development level with no available results.`,
  };
}
