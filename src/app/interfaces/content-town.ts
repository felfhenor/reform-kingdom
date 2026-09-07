import type { CombatStatBlock } from '@interfaces/combat';
import type {
  CaravanMarkupPercentages,
  CommissionOfferSlot,
} from '@interfaces/content-caravan';
import type { GlobalEffectId } from '@interfaces/content-globaleffect';
import type { ItemId } from '@interfaces/content-item';
import type { MonsterId } from '@interfaces/content-monster';
import type { RecipeId } from '@interfaces/content-recipe';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { WorkerId } from '@interfaces/content-worker';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type TownId = Branded<string, 'TownId'>;

// Display-only tier label - unlike Caravan, no shared scale->config lookup table exists;
// every numeric knob below is authored directly per-town instead.
export type TownScaleType = 'City' | 'Town' | 'Outpost';

export type TownTradeskillLevelSeed = {
  tradeskillId: TradeskillId;
  level: number;
};

// Reputation-tier-scaled numeric knob - same "exact tier or fall back to the highest one below it" convention.
export type TownReputationTierValue = {
  tier: number;
  value: number;
};

export type TownCraftingConfig = {
  maxQueueSize: TownReputationTierValue[];
  specialtyTradeskillId: TradeskillId;
  // Towns craft slower than the player so shop stock doesn't churn instantly.
  craftingDurationMultiplier: number;
  // Percent chance per tick to queue a new craft once the queue is at/above craftingChanceItemThreshold.
  craftingChanceOnTick: number;
  // Below this queue length, a new craft is queued every tick (materials permitting); at/above it, craftingChanceOnTick gates it.
  craftingChanceItemThreshold: number;
  tradeskillLevels: TownTradeskillLevelSeed[];
  // Never appears in the player's own tradeskill craft list - exclusively obtainable through this town.
  uniqueRecipeIds: RecipeId[];
};

export type TownTradersConfig = {
  sellItemCount: TownReputationTierValue[];
  // Ticks a stock entry sits unsold before it's cycled out, keeping the shop's selection from going stale.
  itemExpirationTimer: number;
  markupPercentages: CaravanMarkupPercentages;
};

// A worker this town starts with, at the given seed level - references the same pool player-rescuable workers use, not a separate town-worker type.
export type TownGatheringWorker = {
  workerId: WorkerId;
  level: number;
};

// A soft per-town cap on one item - once reached, gathering/commissions stop prioritizing it (deposits still exceed it freely).
export type TownMaterialThreshold = {
  itemId: ItemId;
  maxQuantity: number;
};

// A town's materialThresholds array flattened to a hash for O(1) per-item lookup.
export type TownMaterialThresholdHash = Partial<Record<ItemId, number>>;

export type TownGatheringConfig = {
  gatherRateMultiplier: number;
  // Hidden gold accrual rate: gold += goldGatheredPerMaterial per material gathered, capped via materialThresholds.
  goldGatheredPerMaterial: number;
  materialThresholds: TownMaterialThreshold[];
  workers: TownGatheringWorker[];
};

// `tier` is the reputation tier's ordinal (1 = Friendly .. 4 = Renowned); tier 0 (Neutral) is never authored, meaning no buff.
export type TownReputationBuffTier = {
  tier: number;
  stats: StatBlock;
  combatStats: CombatStatBlock;
  debuffResistances: StatusEffectBlock;
};

export type TownReputationBuffConfig = {
  globalEffectId: GlobalEffectId;
  tiers: TownReputationBuffTier[];
};

export type TownReputationConfig = {
  buff: TownReputationBuffConfig;
};

export type TownDefenseGuardianEntry = {
  monsterId: MonsterId;
  quantity: number;
};

export type TownDefenseGuardianReputationTier = {
  tier: number;
  guardians: TownDefenseGuardianEntry[];
};

export type TownDefenseGuardianConfig = {
  reputationTiers: TownDefenseGuardianReputationTier[];
};

export type TownDefenseAssaulterConfig = {
  numMonsters: number;
  monsterIds: MonsterId[];
  level: LevelRange;
};

export type TownDefenseQuestsConfig = {
  commissions: CommissionOfferSlot[];
};

export type TownDefenseConfig = {
  rewards: DroppedReward[];
  guardian: TownDefenseGuardianConfig;
  assaulter: TownDefenseAssaulterConfig;
  quests: TownDefenseQuestsConfig;
};

export type TownContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: TownId;
    __type: 'town';

    scaleType: TownScaleType;
    level: number;

    crafting: TownCraftingConfig;
    traders: TownTradersConfig;
    gathering: TownGatheringConfig;
    reputation: TownReputationConfig;
    defense: TownDefenseConfig;
  };
