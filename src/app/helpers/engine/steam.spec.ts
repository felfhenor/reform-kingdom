import { afterEach, describe, expect, it, vi } from 'vitest';

import { ensureAchievement } from '@helpers/content/ensure-achievement';
import {
  steamAchievementsActivate,
  steamAchievementsSync,
} from '@helpers/engine/steam';
import { defaultLegacy, legacy } from '@helpers/legacy/legacy';
import type { AchievementId, GameId, WindowWithSteamBridge } from '@interfaces';
import { seedContent } from '@/testing/content';
import { useLegacyStorage } from '@/testing/legacy';

useLegacyStorage();
const bridgeWindow = window as WindowWithSteamBridge;

afterEach(() => {
  delete bridgeWindow.reformElectron;
});

describe('steamAchievementsActivate', () => {
  it('activates nothing without the bridge', async () => {
    expect(await steamAchievementsActivate(['A'])).toEqual([]);
  });
});

describe('steamAchievementsSync', () => {
  it('sends only unlocks that have a steamId', () => {
    seedContent([
      ensureAchievement({ id: 'a-1' as AchievementId, steamId: 'FIRST' }),
      ensureAchievement({ id: 'a-2' as AchievementId }),
    ]);
    const steamAchievementsActivate = vi.fn().mockResolvedValue([]);
    bridgeWindow.reformElectron = { steamAchievementsActivate };
    const unlock = { unlockedAt: 1, runId: 'run' as GameId };
    legacy.set({
      ...defaultLegacy(),
      achievements: {
        ['a-1' as AchievementId]: unlock,
        ['a-2' as AchievementId]: unlock,
        ['gone' as AchievementId]: unlock,
      },
    });

    steamAchievementsSync();

    expect(steamAchievementsActivate).toHaveBeenCalledWith(['FIRST']);
  });

  it('skips the bridge with no unlocks', () => {
    const steamAchievementsActivate = vi.fn().mockResolvedValue([]);
    bridgeWindow.reformElectron = { steamAchievementsActivate };

    steamAchievementsSync();

    expect(steamAchievementsActivate).not.toHaveBeenCalled();
  });
});
