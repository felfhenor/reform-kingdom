/**
 * Validates that a GatherNode's levelCost and gatherResults tiers line up: base
 * level 0 is free and levelCost[N-1] buys level N, so every level 0..levelCost.length
 * needs at least one available result (unrestricted, or levelRequirement matching
 * exactly), and no result may require a level past levelCost.length (unreachable).
 */

import { getEntriesByType } from '@helpers/content/content';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  GatheringContent,
} from '@interfaces';
import { range, uniq } from 'es-toolkit/compat';

function emptyLevels(gathering: GatheringContent): number[] {
  return range(0, gathering.levelCost.length + 1).filter(
    (level) => gatheringResultsAtLevel(gathering, level).length === 0,
  );
}

function unreachableLevels(gathering: GatheringContent): number[] {
  const requirements = gathering.gatherResults.map((r) => r.levelRequirement);
  return uniq(
    requirements.filter(
      (level): level is number =>
        level !== undefined && level > gathering.levelCost.length,
    ),
  );
}

function checkGathering(gathering: GatheringContent): AnalysisCheck {
  const maxLevel = gathering.levelCost.length;
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
        ? `${gathering.name} has ${maxLevel} levelCost entries (levels 0..${maxLevel}), but ${problems.join('; ')}.`
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
        ? 'Every gather node has available results at each level its levelCost entries can buy.'
        : `${failures} gather node(s) have levelCost entries that don't line up with their gatherResults tiers.`,
  };
}
