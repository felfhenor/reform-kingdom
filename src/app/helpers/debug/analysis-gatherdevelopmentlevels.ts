/**
 * Validates that a GatherNode's development levels and gatherResults tiers line up:
 * base level 0 is free and levels[N-1] buys level N, so every level 0..levels.length
 * needs at least one available result (unrestricted, or levelRequirement matching
 * exactly), and no result may require a level past levels.length (unreachable).
 */

import { getEntriesByType } from '@helpers/content/content';
import { worldNodeDevelopmentMaxLevel } from '@helpers/world-node/world-node-development';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  GatheringContent,
} from '@interfaces';
import { range, uniq } from 'es-toolkit/compat';

function emptyLevels(gathering: GatheringContent): number[] {
  return range(0, worldNodeDevelopmentMaxLevel(gathering) + 1).filter(
    (level) => gatheringResultsAtLevel(gathering, level).length === 0,
  );
}

function unreachableLevels(gathering: GatheringContent): number[] {
  const requirements = gathering.gatherResults.map((r) => r.levelRequirement);
  return uniq(
    requirements.filter(
      (level): level is number =>
        level !== undefined && level > worldNodeDevelopmentMaxLevel(gathering),
    ),
  );
}

function checkGathering(gathering: GatheringContent): AnalysisCheck {
  const maxLevel = worldNodeDevelopmentMaxLevel(gathering);
  const empty = emptyLevels(gathering);
  const unreachable = unreachableLevels(gathering);
  const problems = [
    ...(empty.length > 0
      ? [`no gatherResults at level(s) ${empty.join(', ')}`]
      : []),
    ...(unreachable.length > 0
      ? [`gatherResults require unreachable level(s) ${unreachable.join(', ')}`]
      : []),
  ];

  return {
    id: `gatherdevelopmentlevels:${gathering.id}`,
    label: gathering.name,
    status: problems.length > 0 ? 'fail' : 'pass',
    message:
      problems.length > 0
        ? `${gathering.name} has ${maxLevel} development level(s) (levels 0..${maxLevel}), but ${problems.join('; ')}.`
        : `${gathering.name}: every level 0..${maxLevel} has at least one available gatherResults entry.`,
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
        ? 'Every gather node has available results at each level its development levels can buy.'
        : `${failures} gather node(s) have development levels that don't line up with their gatherResults tiers.`,
  };
}
