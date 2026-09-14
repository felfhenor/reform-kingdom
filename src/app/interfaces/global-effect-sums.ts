import type { CombatStatBlock } from '@interfaces/combat';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
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
};
