import { TOWN_REPUTATION_MAX_TIER } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  analysisFail,
  analysisIssueChecks,
  analysisWarn,
} from '@helpers/debug/analysis-utils';
import { taskNodeIssues } from '@helpers/debug/analysis-tasks-world';
import { tasksOrdered } from '@helpers/task/task';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  AnalysisIssue,
  AnalysisRunResult,
  TaskContent,
  TaskRequirement,
  TrainerContent,
  TrainerTeachingContent,
} from '@interfaces';
import { countBy } from 'es-toolkit/compat';

function amountIssues(requirement: TaskRequirement): AnalysisIssue[] {
  const amount =
    'quantity' in requirement
      ? requirement.quantity
      : 'level' in requirement
        ? requirement.level
        : 'tier' in requirement
          ? requirement.tier
          : undefined;
  if (amount !== undefined && amount <= 0) {
    return [analysisFail(`needs a positive amount, not ${amount}`)];
  }
  if (requirement.kind === 'TownReputationTier') {
    return requirement.tier > TOWN_REPUTATION_MAX_TIER
      ? [analysisFail(`tier ${requirement.tier} is above the max tier`)]
      : [];
  }
  return [];
}

function referenceIssues(task: TaskContent): AnalysisIssue[] {
  const { requirement } = task;
  const referencedIds = [
    'itemId' in requirement ? requirement.itemId : undefined,
    'recipeId' in requirement ? requirement.recipeId : undefined,
    'collectibleId' in requirement ? requirement.collectibleId : undefined,
    'trainerId' in requirement ? requirement.trainerId : undefined,
    'workerId' in requirement ? requirement.workerId : undefined,
    'tradeskillId' in requirement ? requirement.tradeskillId : undefined,
    'monsterId' in requirement ? requirement.monsterId : undefined,
    'astralProjectorId' in requirement
      ? requirement.astralProjectorId
      : undefined,
    'townId' in requirement ? requirement.townId : undefined,
  ].filter((id): id is NonNullable<typeof id> => id !== undefined);

  const issues = referencedIds
    .filter((id) => !getEntry(id))
    .map((id) => analysisFail(`references unknown content "${id}"`));

  if (task.rewards.length === 0) issues.push(analysisFail('has no rewards'));
  task.rewards
    .filter((reward) => !getEntry(reward.itemId) || reward.quantity <= 0)
    .forEach((reward) =>
      issues.push(analysisFail(`has an invalid reward "${reward.itemId}"`)),
    );

  return issues;
}

function nearestEarlierReachLevel(earlierTasks: TaskContent[]): number {
  const levels = earlierTasks.flatMap((task) =>
    task.requirement.kind === 'ReachLevel' ? [task.requirement.level] : [],
  );
  return levels.at(-1) ?? 1;
}

function hardLevelGate(requirement: TaskRequirement): number | undefined {
  if (requirement.kind === 'GatherItem') {
    const entry = worldNodeByName(requirement.nodeName);
    return entry ? worldNodeGathering(entry)?.levelRange.min : undefined;
  }
  if (requirement.kind !== 'LearnTeaching') return undefined;

  const trainer = getEntry<TrainerContent>(requirement.trainerId);
  const levels = (trainer?.trainerTeachingIds ?? [])
    .map((id) => getEntry<TrainerTeachingContent>(id)?.requiredLevel)
    .filter((level): level is number => level !== undefined);
  return levels.length > 0 ? Math.min(...levels) : undefined;
}

function levelIssues(
  task: TaskContent,
  earlierTasks: TaskContent[],
): AnalysisIssue[] {
  const gate = hardLevelGate(task.requirement);
  const reached = nearestEarlierReachLevel(earlierTasks);
  if (gate === undefined || gate <= reached) return [];

  return [
    analysisWarn(
      `needs level ${gate}, but the nearest earlier level task only reaches ${reached}`,
    ),
  ];
}

export function runTasksAnalysis(): AnalysisRunResult {
  const tasks = tasksOrdered();
  const orderCounts = countBy(tasks, (task) => task.order);

  const checks = tasks.flatMap((task, index) => {
    const earlierTasks = tasks.slice(0, index);
    const issues = [
      ...(orderCounts[task.order] > 1
        ? [analysisFail(`shares order ${task.order} with another task`)]
        : []),
      ...referenceIssues(task),
      ...amountIssues(task.requirement),
      ...taskNodeIssues(task, earlierTasks),
      ...levelIssues(task, earlierTasks),
    ];

    return analysisIssueChecks(
      `tasks:${task.id}`,
      task.name,
      issues,
      `${task.name} is valid and reachable.`,
    );
  });

  const failures = checks.filter((check) => check.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every task (${tasks.length}) is valid.`
        : `${failures} task problem(s) across ${tasks.length} task(s).`,
  };
}
