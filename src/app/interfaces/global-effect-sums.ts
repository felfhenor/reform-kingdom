import type { CombatStatBlock } from '@interfaces/combat';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { StatBlock } from '@interfaces/stat';

// Precomputed totals across every active global effect + owned collectible -
// see `recomputeGlobalEffectSums` for what keeps this in sync.
export type GlobalEffectSums = {
  stats: StatBlock;
  combatStats: CombatStatBlock;
  debuffResistanceTags: StatusEffectBlock;
  debuffResistanceFlat: number;
  xpGainMultiplierBonus: number;
  goldGainMultiplierBonus: number;
  combatItemDropRateBoost: number;
  gatheringItemDropRateBoost: number;
  armorySizeBoost: number;
  // Sparse - only tradeskills with an active boost have an entry.
  tradeskillQueueSizeBoosts: Partial<Record<TradeskillId, number>>;
  // Fraction (0.1 = 10%), summed additively - never applies to on-path travel.
  offPathTravelSpeedBonus: number;
  decreeClauseCapBoost: number;
};
