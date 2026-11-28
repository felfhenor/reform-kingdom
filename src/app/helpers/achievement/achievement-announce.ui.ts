import { t } from '@helpers/i18n/i18n';
import { contentDescription, contentName } from '@helpers/i18n/i18n-content';
import {
  categoryMessageLog,
  ITEM_ICON_TOKEN,
} from '@helpers/combat/combat-log';
import { isDemoEndPending } from '@helpers/demo/demo.ui';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { desktopNotify } from '@helpers/engine/desktop-notify';
import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import { gamePlayView } from '@helpers/engine/ui';
import { gameloopShouldRun } from '@helpers/gameloop';
import { isStoryScreenPending } from '@helpers/lore/outro';
import { regionIntroPending } from '@helpers/lore/region-intro';
import { worldCurrentLocationState } from '@helpers/state-game';
import { activeTutorialStepView } from '@helpers/tutorial/tutorial-engine.ui';
import type { AchievementAnnouncement, AchievementCard } from '@interfaces';

export function achievementsAnnounceLog({
  unlocked,
  isCatchUp,
}: AchievementAnnouncement): void {
  unlocked.forEach(({ achievement }) => {
    if (!isCatchUp) {
      desktopNotify({
        category: 'Achievements',
        title: 'Achievement Unlocked',
        body: contentName(achievement),
      });
    }
    categoryMessageLog(
      'Achievement',
      'Achievement',
      t('achievementAnnounce.achievementUnlocked', {
        icon: ITEM_ICON_TOKEN,
        achievement: contentName(achievement),
      }),
      { sprite: achievement.sprite, spritesheet: 'achievement' },
    );
    analyticsSendDesignEvent('Achievement:Unlock');
    analyticsSendDesignEvent(
      `Achievement:Unlock:${analyticsSafeSegment(achievement.name)}`,
    );
  });
}

// Unlocks that were already earned (past runs, a save from before an update) arrive as one card, not a parade.
export function achievementCards({
  unlocked,
  isCatchUp,
}: AchievementAnnouncement): AchievementCard[] {
  const cards = unlocked.map(({ achievement }) => ({
    heading: 'Achievement Unlocked',
    name: contentName(achievement),
    description: contentDescription(achievement),
    sprite: achievement.sprite,
  }));
  if (!isCatchUp || cards.length < 2) return cards;

  return [
    {
      ...cards[0],
      heading: 'Achievements',
      name: '',
      count: cards.length,
      description: `You have earned: ${cards.map((c) => c.name).join(', ')}`,
    },
  ];
}

// The card waits for anything else that's speaking to the player, so it's never buried or missed.
export function achievementCardIsHeld(): boolean {
  if (modalHasAnyOpen() || !!activeTutorialStepView()) return true;
  if (!gameloopShouldRun()) return false;

  return (
    isStoryScreenPending() ||
    isDemoEndPending() ||
    (gamePlayView() === 'world' &&
      !!regionIntroPending(worldCurrentLocationState().mapName))
  );
}
