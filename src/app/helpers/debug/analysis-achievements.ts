import { getEntriesByType, getEntry } from '@helpers/content/content';
import { edictIsBlocked } from '@helpers/edict/edict';
import type {
  AchievementCondition,
  AchievementContent,
  AnalysisCheck,
  AnalysisRunResult,
  ContentType,
  EdictContent,
} from '@interfaces';
import { intersection } from 'es-toolkit';

function missingIds(ids: string[], type: ContentType): string[] {
  return ids.filter((id) => getEntry(id)?.__type !== type);
}

function runConditionProblems(
  condition: Extract<AchievementCondition, { type: 'CompleteRun' }>,
): string[] {
  const jobProblems = missingIds(condition.excludedJobIds ?? [], 'job').map(
    (id) => `job "${id}" does not exist`,
  );
  const required = condition.edictIds ?? [];
  const excluded = condition.excludedEdictIds ?? [];
  const edicts = required
    .map((id) => getEntry<EdictContent>(id))
    .filter((edict): edict is EdictContent => !!edict);

  return [
    ...jobProblems,
    ...missingIds([...required, ...excluded], 'edict').map(
      (id) => `edict "${id}" does not exist`,
    ),
    ...edicts
      .filter((edict) => edictIsBlocked(edict, edicts))
      .map((edict) => `${edict.name} can't be picked with the other edicts`),
    ...intersection(required, excluded).map(
      (id) => `edict "${id}" is both required and excluded`,
    ),
  ];
}

function conditionProblems(condition: AchievementCondition): string[] {
  switch (condition.type) {
    case 'Defeat':
      return missingIds(condition.monsterIds, 'monster').map(
        (id) => `monster "${id}" does not exist`,
      );
    case 'Collect':
      return missingIds(condition.collectibleIds, 'collectible').map(
        (id) => `collectible "${id}" does not exist`,
      );
    case 'CompleteRun':
      return runConditionProblems(condition);
    case 'ClearEdicts':
      return getEntriesByType<EdictContent>('edict').some(
        (edict) => edict.kind === condition.kind,
      )
        ? []
        : [`no ${condition.kind} edicts exist`];
    case 'Reach':
    case 'Moment':
      return [];
  }
}

function checkAchievement(achievement: AchievementContent): AnalysisCheck {
  const problems = conditionProblems(achievement.condition);
  return {
    id: `achievements:${achievement.id}`,
    label: achievement.name,
    status: problems.length > 0 ? 'fail' : 'pass',
    message:
      problems.length > 0
        ? `${achievement.name}: ${problems.join('; ')}.`
        : `${achievement.name} can be earned.`,
  };
}

export function runAchievementsAnalysis(): AnalysisRunResult {
  const checks =
    getEntriesByType<AchievementContent>('achievement').map(checkAchievement);
  const failures = checks.filter((check) => check.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every achievement (${checks.length} checked) names real content and a legal edict combination.`
        : `${failures} of ${checks.length} achievement(s) can never be earned.`,
  };
}
