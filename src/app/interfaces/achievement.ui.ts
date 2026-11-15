import type {
  AchievementProgress,
  AchievementUnlock,
} from '@interfaces/achievement';
import type { AchievementContent } from '@interfaces/content-achievement';

export type AchievementTile = {
  achievement: AchievementContent;
  unlock?: AchievementUnlock;
  // A locked hidden achievement shows neither its name nor its art.
  isSecret: boolean;
  progress?: AchievementProgress;
  hasRunSummary: boolean;
};
