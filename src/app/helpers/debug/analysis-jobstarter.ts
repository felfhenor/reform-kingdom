// Audits each job's new-hero kit: starter gear the job can wear at level 1, and default Combat Orders that cast a level 1 skill at a reachable target.

import {
  isCombatOrderTargetModeAllowedForCondition,
  isCombatOrderTargetModeUsable,
} from '@helpers/combat/combat-order-target-mode';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  analysisFail,
  analysisIssueChecks,
} from '@helpers/debug/analysis-utils';
import type {
  AnalysisCheck,
  AnalysisIssue,
  AnalysisRunResult,
  EquipmentContent,
  EquipmentSkillContent,
  JobContent,
  JobDefaultCombatOrder,
} from '@interfaces';

function castIssues(
  order: JobDefaultCombatOrder,
  levelOneSkills: EquipmentSkillContent[],
): AnalysisIssue[] {
  const { condition, action } = order;
  if (action.type !== 'CastSkillFamily') return [];

  const issues: AnalysisIssue[] = [];
  const { family, targetMode } = action;

  if (!levelOneSkills.some((skill) => skill.family === family)) {
    issues.push(analysisFail(`casts "${family}", not a level 1 skill.`));
  }

  if (targetMode === 'SpecificHero') {
    issues.push(analysisFail(`targets a specific hero for "${family}".`));
  }

  if (
    !isCombatOrderTargetModeAllowedForCondition(targetMode, condition.type) ||
    !isCombatOrderTargetModeUsable(family, levelOneSkills, targetMode)
  ) {
    issues.push(
      analysisFail(`"${family}" can never hit its ${targetMode} target.`),
    );
  }

  return issues;
}

function jobDefaultOrderIssues(job: JobContent): AnalysisIssue[] {
  const levelOneSkills = job.skillPath
    .flatMap((path) => path.levels.filter((entry) => entry.level === 1))
    .map((entry) => getEntry<EquipmentSkillContent>(entry.skillId))
    .filter((skill): skill is EquipmentSkillContent => !!skill);

  return job.defaultCombatOrders.flatMap((order) => [
    ...castIssues(order, levelOneSkills),
    // Defaults are seeded before the party exists, so there is no hero to name.
    ...(order.condition.type === 'SpecificHeroHealthPercent'
      ? [analysisFail('has a condition on a specific hero.')]
      : []),
  ]);
}

function jobStarterEquipmentIssues(job: JobContent): AnalysisIssue[] {
  return job.starterEquipmentIds.flatMap((equipmentId) => {
    const content = getEntry<EquipmentContent>(equipmentId);
    if (!content) {
      return [analysisFail(`starter equipment "${equipmentId}" not found.`)];
    }

    const issues: AnalysisIssue[] = [];
    if (!job.equippableTypes.includes(content.type)) {
      issues.push(analysisFail(`cannot equip starter "${content.name}".`));
    }
    if (content.levelRequirement > 1) {
      issues.push(
        analysisFail(
          `starter "${content.name}" needs level ${content.levelRequirement}.`,
        ),
      );
    }
    return issues;
  });
}

export function runJobStarterAnalysis(): AnalysisRunResult {
  const jobs = getEntriesByType<JobContent>('job');

  const checks: AnalysisCheck[] = jobs.flatMap((job) =>
    analysisIssueChecks(
      `jobstarter:job:${job.id}`,
      job.name,
      [...jobStarterEquipmentIssues(job), ...jobDefaultOrderIssues(job)],
      `${job.name}: ${job.starterEquipmentIds.length} starter item(s) and ${job.defaultCombatOrders.length} default order(s), all valid.`,
    ),
  );

  const failures = checks.filter((check) => check.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every job's starting kit (${jobs.length} jobs) is valid.`
        : `${failures} job starting kit problem(s) found.`,
  };
}
