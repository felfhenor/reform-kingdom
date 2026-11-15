import { achievementsCheckReset } from '@helpers/achievement/achievement-check';
import { achievementsUnlock } from '@helpers/achievement/achievement-unlock';
import { getEntry } from '@helpers/content/content';
import { legacyLoad, legacySave } from '@helpers/legacy/legacy';
import { gamestate } from '@helpers/state-game';
import type { AchievementContent } from '@interfaces';

export function debugUnlockAchievement(achievementIdOrName: string): void {
  const achievement = getEntry<AchievementContent>(achievementIdOrName);
  if (achievement?.__type !== 'achievement') return;

  achievementsUnlock([
    {
      achievement,
      unlock: { unlockedAt: Date.now(), runId: gamestate().gameId },
    },
  ]);
}

// Only lasts the session: startup merges unlocks back in from backups and the desktop copy.
export function debugResetAchievements(): void {
  legacySave({ ...legacyLoad(), achievements: {} });
  achievementsCheckReset();
}
