import type {
  AchievementContent,
  AchievementId,
} from '@interfaces/content-achievement';
import type { GameId } from '@interfaces/state-game';

export type AchievementProgress = {
  current: number;
  max: number;
};

export type AchievementUnlock = {
  unlockedAt: number;
  runId: GameId;
};

export type AchievementUnlocks = Partial<
  Record<AchievementId, AchievementUnlock>
>;

export type AchievementUnlocked = {
  achievement: AchievementContent;
  unlock: AchievementUnlock;
};

// A catch-up card has a count and no name of its own.
export type AchievementCard = {
  heading: string;
  name: string;
  count?: number;
  description: string;
  sprite: string;
};

// A catch-up covers unlocks earned by past runs, announced together instead of one card each.
export type AchievementAnnouncement = {
  unlocked: AchievementUnlocked[];
  isCatchUp: boolean;
};
