import { achievementsLocked } from '@helpers/achievement/achievement';
import { achievementsSafely } from '@helpers/achievement/achievement-check';
import { achievementsUnlock } from '@helpers/achievement/achievement-unlock';
import { gamestate } from '@helpers/state-game';
import type { AchievementMoment, AchievementUnlocked } from '@interfaces';

function achievementsEarnedByMoment(
  moment: AchievementMoment,
): AchievementUnlocked[] {
  const unlock = { unlockedAt: Date.now(), runId: gamestate().gameId };
  return achievementsLocked()
    .filter(
      ({ condition }) =>
        condition.type === 'Moment' && condition.moment === moment,
    )
    .map((achievement) => ({ achievement, unlock }));
}

// Call after the action has committed.
export function achievementsMoment(moment: AchievementMoment): void {
  achievementsSafely(
    () => achievementsUnlock(achievementsEarnedByMoment(moment)),
    undefined,
  );
}
