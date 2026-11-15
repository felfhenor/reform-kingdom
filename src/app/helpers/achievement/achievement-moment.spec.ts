import { describe, expect, it } from 'vitest';

import { achievementsMoment } from '@helpers/achievement/achievement-moment';
import { ensureAchievement } from '@helpers/content/ensure-achievement';
import { legacy } from '@helpers/legacy/legacy';
import type { AchievementId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { useLegacyStorage } from '@/testing/legacy';

useLegacyStorage();

const trade = ensureAchievement({
  id: 'trade' as AchievementId,
  name: 'Trade',
  condition: { type: 'Moment', moment: 'CaravanTrade' },
});

describe('achievementsMoment', () => {
  it('unlocks the moment for the current save', () => {
    seedContent([trade]);
    const { gameId } = seedGamestate();

    achievementsMoment('CaravanTrade');

    expect(legacy().achievements?.[trade.id]?.runId).toBe(gameId);
  });

  it('leaves achievements waiting on other conditions alone', () => {
    const level = ensureAchievement({
      id: 'level' as AchievementId,
      name: 'Level',
      condition: { type: 'Reach', counter: 'PartyLevel', target: 1 },
    });
    seedContent([trade, level]);
    seedGamestate();

    achievementsMoment('CaravanTrade');

    expect(legacy().achievements?.[level.id]).toBeUndefined();
  });
});
