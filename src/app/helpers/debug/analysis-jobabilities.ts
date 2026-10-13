// Audits job abilities: every job reference resolves, types are valid, ranks are ordered, and every ability is used.

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { VALID_JOB_ABILITY_TYPES } from '@helpers/content/ensure-helpers-constants';
import {
  analysisFail,
  analysisIssueChecks,
  analysisWarn,
} from '@helpers/debug/analysis-utils';
import type {
  AnalysisCheck,
  AnalysisIssue,
  AnalysisRunResult,
  JobAbilityContent,
  JobAbilityId,
  JobAbilityType,
  JobContent,
} from '@interfaces';
import { groupBy } from 'es-toolkit/compat';

function jobAbilityIssues(job: JobContent): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const typeOwners = new Map<JobAbilityType, string>();

  const byAbility = groupBy(job.abilities, (entry) => entry.jobAbilityId);
  Object.entries(byAbility).forEach(([jobAbilityId, ranks]) => {
    const ability = getEntry<JobAbilityContent>(jobAbilityId);
    if (!ability || ability.__type !== 'jobability') {
      issues.push(
        analysisFail(
          `jobAbilityId "${jobAbilityId}" does not resolve to a JobAbility.`,
        ),
      );
      return;
    }

    const outOfOrder = ranks.some(
      (rank, i) => i > 0 && rank.level <= ranks[i - 1].level,
    );
    if (outOfOrder) {
      issues.push(
        analysisFail(
          `"${ability.name}" rank levels are not strictly increasing (${ranks.map((rank) => rank.level).join(', ')}).`,
        ),
      );
    }

    const owner = typeOwners.get(ability.type);
    if (owner) {
      issues.push(
        analysisFail(
          `"${ability.name}" and "${owner}" share the type ${ability.type}.`,
        ),
      );
    }
    typeOwners.set(ability.type, ability.name);
  });

  return issues;
}

function abilityIssues(
  ability: JobAbilityContent,
  usedIds: Set<JobAbilityId>,
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];

  if (!VALID_JOB_ABILITY_TYPES.includes(ability.type)) {
    issues.push(analysisFail(`has an invalid type "${ability.type}".`));
  }

  if (!usedIds.has(ability.id)) {
    issues.push(analysisWarn('is not used by any job.'));
  }

  return issues;
}

export function runJobAbilitiesAnalysis(): AnalysisRunResult {
  const jobs = getEntriesByType<JobContent>('job');
  const abilities = getEntriesByType<JobAbilityContent>('jobability');

  const usedIds = new Set(
    jobs.flatMap((job) => job.abilities.map((entry) => entry.jobAbilityId)),
  );

  const checks: AnalysisCheck[] = [
    ...jobs.flatMap((job) =>
      analysisIssueChecks(
        `jobabilities:job:${job.id}`,
        job.name,
        jobAbilityIssues(job),
        `${job.name}: ${job.abilities.length} ability rank(s), all valid.`,
      ),
    ),
    ...abilities.flatMap((ability) =>
      analysisIssueChecks(
        `jobabilities:ability:${ability.id}`,
        ability.name,
        abilityIssues(ability, usedIds),
        `${ability.name}: valid and used.`,
      ),
    ),
  ];

  const failures = checks.filter((check) => check.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every job ability (${abilities.length} checked across ${jobs.length} jobs) is valid.`
        : `${failures} job ability problem(s) found.`,
  };
}
