import type { CombatStatBlock } from '@interfaces/combat';
import type {
  CaravanMarkupPercentages,
  CommissionOfferSlot,
} from '@interfaces/content-caravan';
import type { GlobalEffectId } from '@interfaces/content-globaleffect';
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

// A seeded floor for one tradeskill's level - materialization never lowers a town's tradeskill below this.
export type TownTradeskillLevelSeed = {
  tradeskillId: TradeskillId;
  level: number;
};

export type TownCraftingConfig = {
  maxQueueSize: number;
  maxTradeskillLevel: number;
  specialtyTradeskillId: TradeskillId;
  // Multiplies every recipe's craftTime for this town - towns craft slower than the player so shop stock doesn't churn instantly.
  craftingDurationMultiplier: number;
  // Percent chance per tick to queue a new craft once the queue is at/above craftingChanceItemThreshold.
  craftingChanceOnTick: number;
  // Below this queue length, a new craft is queued every tick (materials permitting); at/above it, craftingChanceOnTick gates it.
  craftingChanceItemThreshold: number;
  tradeskillLevels: TownTradeskillLevelSeed[];
  // Never appears in the player's own tradeskill craft list (see isRecipeCraftable) - exclusively obtainable through this town.
  uniqueRecipeIds: RecipeId[];
};

export type TownTradersConfig = {
  sellItemCount: number;
  // Ticks a stock entry sits unsold before it's cycled out, keeping the shop's selection from going stale.
  itemExpirationTimer: number;
  markupPercentages: CaravanMarkupPercentages;
};

// A worker this town starts with, at the given seed level - references the SAME WorkerContent pool player-rescuable workers use, not a separate town-worker type.
export type TownGatheringWorker = {
  workerId: WorkerId;
  level: number;
};

export type TownGatheringConfig = {
  gatherRateMultiplier: number;
  // Hidden gold accrual rate: gold += goldGatheredPerMaterial per material gathered, capped at goldRequiredBeforeCutoff.
  goldGatheredPerMaterial: number;
  goldRequiredBeforeCutoff: number;
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

export type TownDefenseGuardianConfig = {
  numGuardians: number;
  guardianName: string;
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
