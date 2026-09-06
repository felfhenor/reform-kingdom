import { townReputationTierValueResolve } from '@helpers/town/reputation/town-reputation-tier-value';
import type { TownContent } from '@interfaces';

// Reputation-tier-scaled, same convention as townCommissionSlotCount - falls back to the highest authored tier at or below the current one.
export function townCraftQueueSize(town: TownContent): number {
  return townReputationTierValueResolve(town.id, town.crafting.maxQueueSize);
}
