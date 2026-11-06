import { getEntriesByType } from '@helpers/content/content';
import { runStatsState, updateGamestate } from '@helpers/state-game';
import { defaultHeroRunStats } from '@helpers/defaults';
import type {
  CharacterId,
  Combat,
  EncounterId,
  GameState,
  GameStateRunStats,
  RegionContent,
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

// Returns the region only when this clear is the one that sealed it; refights keep the first tick.
export function runStatsRecordSeal(
  encounterId: EncounterId,
): RegionContent | undefined {
  const region = getEntriesByType<RegionContent>('region').find(
    (entry) => entry.seal.sealEncounterId === encounterId,
  );
  if (!region || runStatsState().seals[region.id] !== undefined) {
    return undefined;
  }

  updateGamestate((state) => {
    state.runStats.seals[region.id] ??= state.clock.numTicks;
    return state;
  });
  return region;
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

// A version 3 save that already has seals was started after sealing shipped, so it tracked them from the start.
function runStatsPredatesSeals(
  runStats: GameStateRunStats,
  version: number,
): boolean {
  return version < 4 && Object.keys(runStats.seals).length === 0;
}

// Saves from before run stats (version 3) or seals (version 4) only count from this load, so the summary can say how much was missed.
export function runStatsBackfillTracking(
  runStats: GameStateRunStats,
  numTicks: number,
  version: number,
): GameStateRunStats {
  return {
    ...runStats,
    trackedFromTick: version < 3 ? numTicks : runStats.trackedFromTick,
    sealsTrackedFromTick: runStatsPredatesSeals(runStats, version)
      ? numTicks
      : runStats.sealsTrackedFromTick,
  };
}
