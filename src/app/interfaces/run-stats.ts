import type { CharacterId } from '@interfaces/character';
import type { CombatHpChange } from '@interfaces/combat';

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
};

export type GameStateRunStats = RunStatsTotals & {
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
