import {
  achievementCounter,
  achievementCollectiblesDiscovered,
  achievementCounterSources,
  achievementMonstersKilled,
} from '@helpers/achievement/achievement-counters';
import {
  achievementEdictsCleared,
  achievementRunEarner,
  achievementRunMatchCount,
} from '@helpers/achievement/achievement-run';
import { achievementIsUnlocked } from '@helpers/achievement/achievement-unlock';
import { getEntriesByType } from '@helpers/content/content';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { getMonsterKillCount } from '@helpers/kingdom/bestiary';
import { legacy } from '@helpers/legacy/legacy';
import type {
  AchievementCondition,
  AchievementConditionClearEdicts,
  AchievementContent,
  AchievementProgress,
  RunRecord,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

export function achievementsAll(): AchievementContent[] {
  return getEntriesByType<AchievementContent>('achievement');
}

export function achievementsLocked(): AchievementContent[] {
  return achievementsAll().filter(
    (achievement) => !achievementIsUnlocked(achievement.id),
  );
}

export function achievementProgress(
  condition: AchievementCondition,
): AchievementProgress {
  switch (condition.type) {
    case 'Reach': {
      const progress = achievementCounter(condition.counter);
      const max = condition.target ?? progress.max;
      return { current: Math.min(progress.current, max), max };
    }
    case 'Defeat':
      return {
        current: condition.monsterIds.filter(
          (id) => getMonsterKillCount(id) > 0,
        ).length,
        max: condition.monsterIds.length,
      };
    case 'Collect':
      return {
        current: condition.collectibleIds.filter(isCollectibleDiscovered)
          .length,
        max: condition.collectibleIds.length,
      };
    case 'CompleteRun': {
      const max = condition.count ?? 1;
      const matches = achievementRunMatchCount(condition, legacy().runs);
      return { current: Math.min(matches, max), max };
    }
    case 'ClearEdicts':
      return achievementEdictsCleared(condition, legacy().runs);
    case 'Moment':
      return { current: 0, max: 1 };
  }
}

// Run achievements read the Legacy, not the save, so they have no live sources.
export function achievementConditionSources(
  condition: AchievementCondition,
): (() => unknown)[] {
  switch (condition.type) {
    case 'Reach':
      return achievementCounterSources(condition.counter);
    case 'Defeat':
      return [achievementMonstersKilled];
    case 'Collect':
      return [achievementCollectiblesDiscovered];
    case 'CompleteRun':
    case 'ClearEdicts':
    case 'Moment':
      return [];
  }
}

export function achievementIsJudgedOnRuns(
  condition: AchievementCondition,
): boolean {
  return condition.type === 'CompleteRun' || condition.type === 'ClearEdicts';
}

// An empty counter (e.g. no outposts in this build) never counts as met.
export function achievementProgressIsMet(
  progress: AchievementProgress,
): boolean {
  return progress.max > 0 && progress.current >= progress.max;
}

// The run that cleared the last one, so the unlock dates from when it was really earned.
function achievementEdictsClearedEarner(
  condition: AchievementConditionClearEdicts,
  runs: RunRecord[],
): RunRecord | undefined {
  if (!achievementProgressIsMet(achievementEdictsCleared(condition, runs)))
    return undefined;

  const ordered = sortBy(runs, (run) => run.endedAt);
  return ordered.find((_, index) =>
    achievementProgressIsMet(
      achievementEdictsCleared(condition, ordered.slice(0, index + 1)),
    ),
  );
}

export function achievementEarnerRun(
  condition: AchievementCondition,
  runs: RunRecord[],
): RunRecord | undefined {
  switch (condition.type) {
    case 'CompleteRun':
      return achievementRunEarner(condition, runs);
    case 'ClearEdicts':
      return achievementEdictsClearedEarner(condition, runs);
    default:
      return undefined;
  }
}
