import { ensureArray } from '@helpers/content/ensure-helpers-core';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureCommissionOfferSlot } from '@helpers/content/ensure-helpers-quests';
import {
  ensureCombatStats,
  ensureStats,
  ensureTagResistances,
} from '@helpers/content/ensure-helpers-stats';
import type {
  GlobalEffectId,
  MonsterId,
  TownContent,
  TownCraftingConfig,
  TownDefenseAssaulterConfig,
  TownDefenseConfig,
  TownDefenseGuardianConfig,
  TownDefenseGuardianEntry,
  TownDefenseGuardianReputationTier,
  TownDefenseQuestsConfig,
  TownGatheringConfig,
  TownGatheringWorker,
  TownId,
  TownReputationBuffTier,
  TownReputationConfig,
  TownTradersConfig,
  TownTradeskillLevelSeed,
  TradeskillId,
  WorkerId,
} from '@interfaces';

function ensureTownTradeskillLevelSeed(
  seed: Partial<TownTradeskillLevelSeed> = {},
): TownTradeskillLevelSeed {
  return {
    tradeskillId: seed.tradeskillId ?? ('UNKNOWN' as TradeskillId),
    level: seed.level ?? 1,
  };
}

function ensureTownCrafting(
  crafting: Partial<TownCraftingConfig> = {},
): TownCraftingConfig {
  return {
    maxQueueSize: crafting.maxQueueSize ?? 1,
    maxTradeskillLevel: crafting.maxTradeskillLevel ?? 1,
    specialtyTradeskillId:
      crafting.specialtyTradeskillId ?? ('UNKNOWN' as TradeskillId),
    craftingDurationMultiplier: crafting.craftingDurationMultiplier ?? 1,
    craftingChanceOnTick: crafting.craftingChanceOnTick ?? 100,
    craftingChanceItemThreshold: crafting.craftingChanceItemThreshold ?? 1,
    tradeskillLevels: ensureArray(
      crafting.tradeskillLevels,
      ensureTownTradeskillLevelSeed,
    ),
    uniqueRecipeIds: crafting.uniqueRecipeIds ?? [],
  };
}

function ensureTownTraders(
  traders: Partial<TownTradersConfig> = {},
): TownTradersConfig {
  return {
    sellItemCount: traders.sellItemCount ?? 0,
    itemExpirationTimer: traders.itemExpirationTimer ?? 0,
    markupPercentages: traders.markupPercentages ?? { sell: 0, buy: 0 },
  };
}

function ensureTownGatheringWorker(
  worker: Partial<TownGatheringWorker> = {},
): TownGatheringWorker {
  return {
    workerId: worker.workerId ?? ('UNKNOWN' as WorkerId),
    level: worker.level ?? 1,
  };
}

function ensureTownGathering(
  gathering: Partial<TownGatheringConfig> = {},
): TownGatheringConfig {
  return {
    gatherRateMultiplier: gathering.gatherRateMultiplier ?? 1,
    goldGatheredPerMaterial: gathering.goldGatheredPerMaterial ?? 0,
    goldRequiredBeforeCutoff: gathering.goldRequiredBeforeCutoff ?? 0,
    workers: ensureArray(gathering.workers, ensureTownGatheringWorker),
  };
}

function ensureTownReputationBuffTier(
  tier: Partial<TownReputationBuffTier> = {},
): TownReputationBuffTier {
  return {
    tier: tier.tier ?? 0,
    stats: ensureStats(tier.stats),
    combatStats: ensureCombatStats(tier.combatStats),
    debuffResistances: ensureTagResistances(tier.debuffResistances),
  };
}

function ensureTownReputation(
  reputation: Partial<TownReputationConfig> = {},
): TownReputationConfig {
  return {
    buff: {
      globalEffectId:
        reputation.buff?.globalEffectId ?? ('UNKNOWN' as GlobalEffectId),
      tiers: ensureArray(reputation.buff?.tiers, ensureTownReputationBuffTier),
    },
  };
}

function ensureTownDefenseGuardianEntry(
  entry: Partial<TownDefenseGuardianEntry> = {},
): TownDefenseGuardianEntry {
  return {
    monsterId: entry.monsterId ?? ('UNKNOWN' as MonsterId),
    quantity: entry.quantity ?? 0,
  };
}

function ensureTownDefenseGuardianReputationTier(
  tier: Partial<TownDefenseGuardianReputationTier> = {},
): TownDefenseGuardianReputationTier {
  return {
    tier: tier.tier ?? 0,
    guardians: ensureArray(tier.guardians, ensureTownDefenseGuardianEntry),
  };
}

function ensureTownDefenseGuardian(
  guardian: Partial<TownDefenseGuardianConfig> = {},
): TownDefenseGuardianConfig {
  return {
    reputationTiers: ensureArray(
      guardian.reputationTiers,
      ensureTownDefenseGuardianReputationTier,
    ),
  };
}

function ensureTownDefenseAssaulter(
  assaulter: Partial<TownDefenseAssaulterConfig> = {},
): TownDefenseAssaulterConfig {
  return {
    numMonsters: assaulter.numMonsters ?? 0,
    monsterIds: assaulter.monsterIds ?? [],
    level: assaulter.level ?? { min: 1, max: 1 },
  };
}

function ensureTownDefenseQuests(
  quests: Partial<TownDefenseQuestsConfig> = {},
): TownDefenseQuestsConfig {
  return {
    commissions: ensureArray(quests.commissions, ensureCommissionOfferSlot),
  };
}

function ensureTownDefense(
  defense: Partial<TownDefenseConfig> = {},
): TownDefenseConfig {
  return {
    rewards: ensureArray(defense.rewards, ensureDroppedReward),
    guardian: ensureTownDefenseGuardian(defense.guardian),
    assaulter: ensureTownDefenseAssaulter(defense.assaulter),
    quests: ensureTownDefenseQuests(defense.quests),
  };
}

export function ensureTown(town: Partial<TownContent>): Required<TownContent> {
  return {
    id: town.id ?? ('UNKNOWN' as TownId),
    name: town.name ?? 'UNKNOWN',
    __type: 'town',
    description: town.description ?? 'UNKNOWN',
    hidden: town.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      town.invisibleUntilCollectibleIdsFound ?? [],
    scaleType: town.scaleType ?? 'Outpost',
    level: town.level ?? 1,
    crafting: ensureTownCrafting(town.crafting),
    traders: ensureTownTraders(town.traders),
    gathering: ensureTownGathering(town.gathering),
    reputation: ensureTownReputation(town.reputation),
    defense: ensureTownDefense(town.defense),
  };
}
