import type { CharacterId } from '@interfaces/character';
import type { CombatHpChange } from '@interfaces/combat';
import type { RegionId } from '@interfaces/content-region';

export type RunStatsBiggestHit = {
  amount: number;
  skillFamily: string;
};

export type HeroRunStats = {
  kills: number;
  damageDealt: number;
  damageTaken: number;
  deaths: number;
  healing: number;
  crits: number;
  statusEffectsApplied: number;
  damageBlocked: number;
  fights: number;
  biggestHit?: RunStatsBiggestHit;
  // Keyed by skill family, so a skill's upgrades count as the same skill.
  skillUses: Record<string, number>;
};

export type RunStatsTotals = {
  // Above 0 when the run started before stats were tracked, so earlier play is missing from the counts.
  trackedFromTick: number;
  goldEarned: number;
  fightsWon: number;
  fightsLost: number;
  itemsCrafted: number;
  felDefeatedTick?: number;
  // The tick each region was sealed on. Missing on runs recorded before seals were tracked.
  seals?: Partial<Record<RegionId, number>>;
  // Above 0 when the run started before seals were tracked, so regions sealed earlier only count from their next clear.
  sealsTrackedFromTick?: number;
};

export type GameStateRunStats = RunStatsTotals & {
  seals: Partial<Record<RegionId, number>>;
  sealsTrackedFromTick: number;
  heroes: Partial<Record<CharacterId, HeroRunStats>>;
};

export type RunStatsHit = {
  change: CombatHpChange;
  // Set for status effect ticks, whose creator may be gone; otherwise the source combatant is credited.
  creditHeroId?: CharacterId;
  prevented?: number;
  skillFamily?: string;
  isCriticalHit?: boolean;
};
