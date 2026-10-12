// The schema never requires nested fields, so a missing developTime would silently mean an instant upgrade.

import { getEntriesByType } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  WorldNodeDevelopableContent,
} from '@interfaces';

function checkDevelopable(content: WorldNodeDevelopableContent): AnalysisCheck {
  const badLevels = content.levels
    .map((level, index) => ({ level: index + 1, time: level.developTime }))
    .filter(({ time }) => !(time > 0))
    .map(({ level }) => `+${level}`);

  return {
    id: `nodedevelopmenttimes:${content.id}`,
    label: content.name,
    status: badLevels.length > 0 ? 'fail' : 'pass',
    message:
      badLevels.length > 0
        ? `${content.name} (${content.__type}) has no positive developTime at level(s) ${badLevels.join(', ')}.`
        : `${content.name}: every development level has a positive developTime.`,
  };
}

export function runNodeDevelopmentTimesAnalysis(): AnalysisRunResult {
  const developables: WorldNodeDevelopableContent[] = [
    ...getEntriesByType<WorldNodeDevelopableContent>('gathering'),
    ...getEntriesByType<WorldNodeDevelopableContent>('shrine'),
    ...getEntriesByType<WorldNodeDevelopableContent>('outpost'),
  ];

  const checks = developables.map(checkDevelopable);
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every gather node, shrine and outpost (${developables.length} checked) has a positive developTime on each level.`
        : `${failures} of ${developables.length} developable node(s) are missing a developTime.`,
  };
}
