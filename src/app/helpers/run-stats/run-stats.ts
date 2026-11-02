import { updateGamestate } from '@helpers/state-game';
import { defaultHeroRunStats } from '@helpers/defaults';
import type {
  CharacterId,
  Combat,
  GameState,
  GameStateRunStats,
} from '@interfaces';

// Mutate `state` directly, for callers already inside their own `updateGamestate`.

export function runStatsAddGold(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.runStats.goldEarned += amount;
}

export function runStatsRecordFight(state: GameState, won: boolean): void {
  if (won) state.runStats.fightsWon += 1;
  else state.runStats.fightsLost += 1;
}

export function runStatsRecordCraft(state: GameState): void {
  state.runStats.itemsCrafted += 1;
}

// Refights of Fel keep the first victory's tick.
export function runStatsRecordFelDefeat(state: GameState): void {
  state.runStats.felDefeatedTick ??= state.clock.numTicks;
}

// Counts fights, not encounters: each fight of a chained encounter is its own win or loss.
export function runStatsRecordFightEnd(
  won: boolean,
  heroIds: CharacterId[],
): void {
  updateGamestate((state) => {
    runStatsRecordFight(state, won);
    heroIds.forEach((heroId) => {
      const stats = (state.runStats.heroes[heroId] ??= defaultHeroRunStats());
      stats.fights += 1;
    });
    return state;
  });
}

// Summons aren't party members, so they never add fights to their owner.
export function runStatsFightHeroIds(combat: Combat): CharacterId[] {
  return combat.heroes
    .filter((hero) => !hero.summonerId)
    .map((hero) => hero.id as CharacterId);
}

// Saves from before run stats (version 3) only count from this load, so the summary can say how much was missed.
export function runStatsBackfillTracking(
  runStats: GameStateRunStats,
  numTicks: number,
  version: number,
): GameStateRunStats {
  return version < 3 ? { ...runStats, trackedFromTick: numTicks } : runStats;
}
