import {
  achievementCounter,
  achievementCollectiblesDiscovered,
  achievementCounterSources,
  achievementMonstersKilled,
} from '@helpers/achievement/achievement-counters';
import { achievementRunMatchCount } from '@helpers/achievement/achievement-run';
import { achievementIsUnlocked } from '@helpers/achievement/achievement-unlock';
import { getEntriesByType } from '@helpers/content/content';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { getMonsterKillCount } from '@helpers/kingdom/bestiary';
import { legacy } from '@helpers/legacy/legacy';
import type {
  AchievementCondition,
  AchievementContent,
  AchievementProgress,
} from '@interfaces';

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
      return [];
  }
}

// An empty counter (e.g. no outposts in this build) never counts as met.
export function achievementProgressIsMet(
  progress: AchievementProgress,
): boolean {
  return progress.max > 0 && progress.current >= progress.max;
}
