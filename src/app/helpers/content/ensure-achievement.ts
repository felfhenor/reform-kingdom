import { ACHIEVEMENT_COUNTERS } from '@interfaces';
import type {
  AchievementCondition,
  AchievementConditionCollect,
  AchievementConditionCompleteRun,
  AchievementConditionDefeat,
  AchievementConditionReach,
  AchievementContent,
  AchievementId,
  MonsterId,
} from '@interfaces';

// Unknown types and counters fall back to an unbeatable monster, so a typo can't unlock anything or break the checks.
export function ensureAchievementCondition(
  condition: Record<string, unknown> = {},
): AchievementCondition {
  switch (condition['type']) {
    case 'Reach': {
      const reach = condition as Partial<AchievementConditionReach>;
      const { counter } = reach;
      if (counter && ACHIEVEMENT_COUNTERS.includes(counter)) {
        return { ...reach, type: 'Reach', counter };
      }
      break;
    }
    case 'CompleteRun': {
      const run = condition as Partial<AchievementConditionCompleteRun>;
      return { ...run, type: 'CompleteRun', count: run.count ?? 1 };
    }
    case 'Collect': {
      const collectibleIds =
        (condition as Partial<AchievementConditionCollect>).collectibleIds ??
        [];
      if (collectibleIds.length > 0) return { type: 'Collect', collectibleIds };
      break;
    }
    case 'Defeat': {
      const monsterIds =
        (condition as Partial<AchievementConditionDefeat>).monsterIds ?? [];
      if (monsterIds.length > 0) return { type: 'Defeat', monsterIds };
    }
  }

  return { type: 'Defeat', monsterIds: ['UNKNOWN' as MonsterId] };
}

export function ensureAchievement(
  achievement: Partial<AchievementContent>,
): Required<AchievementContent> {
  return {
    id: achievement.id ?? ('UNKNOWN' as AchievementId),
    name: achievement.name ?? 'UNKNOWN',
    __type: 'achievement',
    description: achievement.description ?? 'UNKNOWN',
    sprite: achievement.sprite ?? '0000',
    hidden: achievement.hidden ?? false,
    hideProgress: achievement.hideProgress ?? false,
    condition: ensureAchievementCondition(achievement.condition),
  };
}
