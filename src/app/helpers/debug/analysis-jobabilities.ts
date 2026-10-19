// Audits job abilities: types are valid, no job tree has two abilities of one type, and every ability is granted by some tree.

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { VALID_JOB_ABILITY_TYPES } from '@helpers/content/ensure-helpers-constants';
import {
  analysisFail,
  analysisIssueChecks,
  analysisWarn,
} from '@helpers/debug/analysis-utils';
import { skillTreeJobNodes } from '@helpers/hero/skill-tree-content';
import type {
  AnalysisCheck,
  AnalysisIssue,
  AnalysisRunResult,
  JobAbilityContent,
  JobAbilityId,
  JobAbilityType,
  JobContent,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

function jobTreeAbilityIds(job: JobContent): JobAbilityId[] {
  return uniq(
    skillTreeJobNodes(job.id)
      .flatMap((node) => node.effects)
      .flatMap((effect) =>
        effect.kind === 'JobAbility' ? [effect.jobAbilityId] : [],
      ),
  );
}

// Unknown ability references and rank order are covered by validate:skilltrees.
function jobAbilityIssues(job: JobContent): AnalysisIssue[] {
  const typeOwners = new Map<JobAbilityType, string>();

  return jobTreeAbilityIds(job).flatMap((jobAbilityId) => {
    const ability = getEntry<JobAbilityContent>(jobAbilityId);
    if (!ability) return [];

    const owner = typeOwners.get(ability.type);
    typeOwners.set(ability.type, ability.name);
    return owner
      ? [
          analysisFail(
            `"${ability.name}" and "${owner}" share the type ${ability.type}.`,
          ),
        ]
      : [];
  });
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

  const usedIds = new Set(jobs.flatMap(jobTreeAbilityIds));

  const checks: AnalysisCheck[] = [
    ...jobs.flatMap((job) =>
      analysisIssueChecks(
        `jobabilities:job:${job.id}`,
        job.name,
        jobAbilityIssues(job),
        `${job.name}: ${jobTreeAbilityIds(job).length} abilities, all valid.`,
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
