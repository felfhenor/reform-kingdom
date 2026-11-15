import {
  achievementProgress,
  achievementsAll,
  achievementsLocked,
} from '@helpers/achievement/achievement';
import { legacy, legacyRunById } from '@helpers/legacy/legacy';
import type { AchievementContent, AchievementTile, GameId } from '@interfaces';

// Live progress reads the current save, so it needs one; a bar out of 1 says nothing a locked tile doesn't.
function achievementTileProgress(
  achievement: AchievementContent,
  hasSave: boolean,
): AchievementTile['progress'] {
  const { condition } = achievement;
  if (achievement.hidden || achievement.hideProgress) return undefined;
  if (condition.type !== 'CompleteRun' && !hasSave) return undefined;

  const progress = achievementProgress(condition);
  return progress.max > 1 ? progress : undefined;
}

function achievementTile(
  achievement: AchievementContent,
  hasSave: boolean,
): AchievementTile {
  const unlock = legacy().achievements?.[achievement.id];
  return {
    achievement,
    unlock,
    isSecret: achievement.hidden && !unlock,
    progress: unlock
      ? undefined
      : achievementTileProgress(achievement, hasSave),
    hasRunSummary: !!unlock && !!legacyRunById(unlock.runId),
  };
}

export function achievementTiles(hasSave: boolean): AchievementTile[] {
  return achievementsAll().map((achievement) =>
    achievementTile(achievement, hasSave),
  );
}

export function achievementsEarnedByRun(runId: GameId): AchievementContent[] {
  return achievementsAll().filter(
    (achievement) => legacy().achievements?.[achievement.id]?.runId === runId,
  );
}

export function achievementsUnlockedCount(): number {
  return achievementsAll().length - achievementsLocked().length;
}
