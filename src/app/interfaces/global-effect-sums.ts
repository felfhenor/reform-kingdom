import type { CombatStatBlock } from '@interfaces/combat';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { StatBlock } from '@interfaces/stat';
import type { WorldNodeType } from '@interfaces/tiled-map';

// Precomputed totals across every active global effect + owned collectible -
// see `recomputeGlobalEffectSums` for what keeps this in sync.
export type GlobalEffectSums = {
  stats: StatBlock;
  heroStatPercents: StatBlock;
  enemyStatPercents: StatBlock;
  combatStats: CombatStatBlock;
  debuffResistanceTags: StatusEffectBlock;
  debuffResistanceFlat: number;
  xpGainMultiplierBonus: number;
  goldGainMultiplierBonus: number;
  shopPriceMultiplierBonus: number;
  traderPriceMultiplierBonus: number;
  deathPenaltyMultiplierBonus: number;
  levelStatMultiplierBonus: number;
  shrineBuffsPermanent: boolean;
  enemyExtraSkills: number;
  wipeEndsRun: boolean;
  workerCraftSpeedPercent: number;
  workerGatherSpeedPercent: number;
  townShopNoEquipment: boolean;
  cursedDrops: boolean;
  dropExtraAffixes: number;
  craftedExtraAffixes: number;
  recipeMaterialBoost: number;
  craftTimeMultiplierBonus: number;
  skillPointsPerLevel: number;
  reclassDisabled: boolean;
  partySharesClass: boolean;
  jobAbilitiesStack: boolean;
  // Sparse - only removed node types have an entry.
  removedWorldNodeTypes: Partial<Record<WorldNodeType, boolean>>;
  // Sparse - only node types with a starting level have an entry.
  worldNodeStartingLevels: Partial<Record<WorldNodeType, number>>;
  commissionReputationBonus: number;
  townCommissionSlotBoost: number;
  shrineBuffDurationBonus: number;
  shrineBuffStrengthBonus: number;
  astralSpellDurationBonus: number;
  astralSpellStrengthBonus: number;
  combatItemDropRateBoost: number;
  gatheringItemDropRateBoost: number;
  armorySizeBoost: number;
  // Sparse - only tradeskills with an active boost have an entry.
  tradeskillQueueSizeBoosts: Partial<Record<TradeskillId, number>>;
  // Fraction (0.1 = 10%), summed additively - never applies to on-path travel.
  offPathTravelSpeedBonus: number;
  // Fraction (0.1 = 10%), summed additively - never applies to off-path travel.
  onPathTravelSpeedBonus: number;
  decreeClauseCapBoost: number;
};
