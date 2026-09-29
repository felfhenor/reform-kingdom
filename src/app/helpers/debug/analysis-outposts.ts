import { OUTPOST_MAX_LEVEL } from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  OutpostContent,
} from '@interfaces';

function checkOutpost(outpost: OutpostContent): AnalysisCheck {
  const id = `outposts:${outpost.id}`;
  const problems: string[] = [];

  if (outpost.levels.length !== OUTPOST_MAX_LEVEL) {
    problems.push(
      `has ${outpost.levels.length} level(s), expected ${OUTPOST_MAX_LEVEL}`,
    );
  }

  outpost.levels.forEach((level, index) => {
    if (level.costs.length === 0) {
      problems.push(`level +${index + 1} has no costs`);
    }
  });

  if (problems.length > 0) {
    return {
      id,
      label: outpost.name,
      status: 'fail',
      message: `${outpost.name}: ${problems.join('; ')}.`,
    };
  }

  return {
    id,
    label: outpost.name,
    status: 'pass',
    message: `${outpost.name}: ${OUTPOST_MAX_LEVEL} costed level(s).`,
  };
}

export function runOutpostsAnalysis(): AnalysisRunResult {
  const outposts = getEntriesByType<OutpostContent>('outpost');
  const checks = outposts.map(checkOutpost);
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every outpost (${outposts.length} checked) has ${OUTPOST_MAX_LEVEL} costed levels.`
        : `${failures} of ${outposts.length} outpost(s) have a level configuration problem.`,
  };
}
