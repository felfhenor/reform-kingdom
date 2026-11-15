import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  achievementIsUnlocked,
  achievementsAnnounced$,
  achievementsUnlock,
} from '@helpers/achievement/achievement-unlock';
import { ensureAchievement } from '@helpers/content/ensure-achievement';
import { LEGACY_STORAGE_KEY, defaultLegacy } from '@helpers/legacy/legacy';
import type {
  AchievementAnnouncement,
  AchievementId,
  GameId,
} from '@interfaces';
import { useLegacyStorage } from '@/testing/legacy';

const store = useLegacyStorage();
const achievement = ensureAchievement({
  id: 'first' as AchievementId,
  name: 'First',
});
const earned = (unlockedAt: number) => ({
  achievement,
  unlock: { unlockedAt, runId: 'run' as GameId },
});

function announcements(): AchievementAnnouncement[] {
  const seen: AchievementAnnouncement[] = [];
  const subscription = achievementsAnnounced$.subscribe((announcement) =>
    seen.push(announcement),
  );
  onTestFinished(() => subscription.unsubscribe());
  return seen;
}

describe('achievementsUnlock', () => {
  it('saves to the Legacy and announces once', () => {
    const seen = announcements();

    achievementsUnlock([earned(5)]);
    achievementsUnlock([earned(9)]);

    expect(achievementIsUnlocked(achievement.id)).toBe(true);
    expect(seen).toHaveLength(1);
    expect(
      JSON.parse(store.get(LEGACY_STORAGE_KEY) ?? '{}').achievements.first,
    ).toEqual({ unlockedAt: 5, runId: 'run' });
  });

  it('stays quiet about an unlock another tab already saved', () => {
    store.set(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        ...defaultLegacy(),
        achievements: { first: { unlockedAt: 1, runId: 'other' } },
      }),
    );
    const seen = announcements();

    achievementsUnlock([earned(5)]);

    expect(seen).toHaveLength(0);
    expect(achievementIsUnlocked(achievement.id)).toBe(true);
  });

  it('stops trying for the session once a save fails', () => {
    const seen = announcements();
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new Error('quota');
    });

    achievementsUnlock([earned(5)]);
    achievementsUnlock([earned(6)]);

    expect(achievementIsUnlocked(achievement.id)).toBe(false);
    expect(seen).toHaveLength(0);
  });
});
