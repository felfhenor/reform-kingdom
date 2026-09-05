import {
  townReputationTier,
  townReputationTierMultiplier,
} from '@helpers/town/reputation/town-reputation';
import type { TownContent } from '@interfaces';

// Reputation-tier-scaled, same convention as townCommissionSlotCount - falls back to the highest authored tier at or below the current one.
export function townCraftQueueSize(town: TownContent): number {
  const tier = townReputationTier(town.id);
  const table: Partial<Record<number, number>> = {};
  town.crafting.maxQueueSize.forEach((entry) => {
    table[entry.tier] = entry.queueSize;
  });

  return townReputationTierMultiplier(tier, table) ?? 0;
}
