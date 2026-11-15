import {
  achievementConditionSources,
  achievementProgress,
  achievementProgressIsMet,
  achievementsLocked,
} from '@helpers/achievement/achievement';
import { achievementRunEarner } from '@helpers/achievement/achievement-run';
import { achievementsUnlock } from '@helpers/achievement/achievement-unlock';
import { error } from '@helpers/engine/logging';
import { legacy, legacyRunFromGame } from '@helpers/legacy/legacy';
import { isFelDefeated } from '@helpers/lore/outro';
import { gamestate } from '@helpers/state-game';
import type { AchievementUnlocked, GameId, RunRecord } from '@interfaces';

// Once per game per session, so the snapshot isn't rebuilt every loop after Fel falls.
let felRunCheckedGameId: GameId | undefined;

// The first live check of a save is its catch-up, announced as one card.
let liveCheckedGameId: GameId | undefined;

// Last value seen from each source: a slice (whose reference only changes when it does) or a cheap value.
const achievementSourcesSeen = new Map<() => unknown, unknown>();

// A bad achievement must never stop the loop from saving or a run from ending.
export function achievementsSafely<T>(check: () => T, fallback: T): T {
  try {
    return check();
  } catch (e) {
    error('Achievement', 'Achievement check failed:', e);
    return fallback;
  }
}

export function achievementsEarnedByRuns(
  runs: RunRecord[],
): AchievementUnlocked[] {
  return achievementsLocked().flatMap((achievement) => {
    const { condition } = achievement;
    const earner =
      condition.type === 'CompleteRun'
        ? achievementRunEarner(condition, runs)
        : undefined;
    return earner
      ? [
          {
            achievement,
            unlock: { unlockedAt: earner.endedAt, runId: earner.id },
          },
        ]
      : [];
  });
}

// The run is joined with every recorded run, for achievements that count runs.
function achievementsEarnedWithRun(run: RunRecord): AchievementUnlocked[] {
  return achievementsEarnedByRuns([
    ...legacy().runs.filter((entry) => entry.id !== run.id),
    run,
  ]);
}

export function achievementsCheckRun(run: RunRecord): void {
  achievementsSafely(
    () => achievementsUnlock(achievementsEarnedWithRun(run)),
    undefined,
  );
}

// The first check sees every source as changed, which doubles as the catch-up for a newly loaded save.
function achievementSourceChanged(source: () => unknown): boolean {
  const value = source();
  const changed =
    !achievementSourcesSeen.has(source) ||
    achievementSourcesSeen.get(source) !== value;
  achievementSourcesSeen.set(source, value);
  return changed;
}

function achievementsEarnedLive(): AchievementUnlocked[] {
  const locked = achievementsLocked();
  const sources = new Set(
    locked.flatMap(({ condition }) => achievementConditionSources(condition)),
  );
  const changed = new Set([...sources].filter(achievementSourceChanged));
  if (changed.size === 0) return [];

  const unlock = { unlockedAt: Date.now(), runId: gamestate().gameId };
  return locked
    .filter(
      ({ condition }) =>
        achievementConditionSources(condition).some((source) =>
          changed.has(source),
        ) && achievementProgressIsMet(achievementProgress(condition)),
    )
    .map((achievement) => ({ achievement, unlock }));
}

// Run achievements land when Fel falls rather than whenever the run is ended.
function achievementsEarnedFelRun(): AchievementUnlocked[] {
  const gameId = gamestate().gameId;
  if (felRunCheckedGameId === gameId || !isFelDefeated()) return [];

  felRunCheckedGameId = gameId;
  return achievementsEarnedWithRun(legacyRunFromGame('Completed'));
}

// Unlocked together, so a save's first check (its catch-up) collapses into a single card.
export function achievementsCheckLive(): void {
  const gameId = gamestate().gameId;
  const isCatchUp = liveCheckedGameId !== gameId;
  liveCheckedGameId = gameId;
  // Another save can share a value by chance, so a new one starts with nothing seen.
  if (isCatchUp) achievementSourcesSeen.clear();

  const earned = [
    ...achievementsSafely(achievementsEarnedLive, []),
    ...achievementsSafely(achievementsEarnedFelRun, []),
  ];
  achievementsSafely(() => achievementsUnlock(earned, isCatchUp), undefined);
}

// Debug resets clear these too, so already-met achievements are re-checked straight away.
export function achievementsCheckReset(): void {
  achievementSourcesSeen.clear();
  felRunCheckedGameId = undefined;
  liveCheckedGameId = undefined;
}
