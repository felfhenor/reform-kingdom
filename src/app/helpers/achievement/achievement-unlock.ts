import { error } from '@helpers/engine/logging';
import { steamAchievementsSync } from '@helpers/engine/steam';
import { legacy, legacyLoad, legacySave } from '@helpers/legacy/legacy';
import { legacyMergeAchievements } from '@helpers/legacy/legacy-merge';
import type {
  AchievementAnnouncement,
  AchievementId,
  AchievementUnlocked,
} from '@interfaces';
import { Subject } from 'rxjs';

const achievementsAnnounced = new Subject<AchievementAnnouncement>();
export const achievementsAnnounced$ = achievementsAnnounced.asObservable();

// Latched so a full or blocked Legacy isn't retried on every game loop.
let achievementWritesFailed = false;

export function achievementIsUnlocked(id: AchievementId): boolean {
  return !!legacy().achievements?.[id];
}

// Reloads first so an unlock another tab already saved keeps its earlier date and isn't announced twice.
function achievementsSave(
  earned: AchievementUnlocked[],
): AchievementUnlocked[] {
  const current = legacyLoad();
  const fresh = earned.filter(
    ({ achievement }) => !current.achievements?.[achievement.id],
  );
  if (fresh.length === 0) {
    legacy.set(current);
    return [];
  }

  const unlocks = Object.fromEntries(
    fresh.map(({ achievement, unlock }) => [achievement.id, unlock]),
  );
  legacySave({
    ...current,
    achievements: legacyMergeAchievements(current.achievements ?? {}, [
      unlocks,
    ]),
  });
  return fresh;
}

export function achievementsUnlock(
  earned: AchievementUnlocked[],
  isCatchUp = false,
): void {
  const candidates = earned.filter(
    ({ achievement }) => !achievementIsUnlocked(achievement.id),
  );
  if (candidates.length === 0 || achievementWritesFailed) return;

  try {
    const unlocked = achievementsSave(candidates);
    if (unlocked.length === 0) return;

    achievementsAnnounced.next({ unlocked, isCatchUp });
    steamAchievementsSync();
  } catch (e) {
    achievementWritesFailed = true;
    error('Achievement', 'Could not save unlocked achievements:', e);
  }
}
