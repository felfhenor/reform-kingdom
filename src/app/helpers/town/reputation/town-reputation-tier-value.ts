import {
  townReputationTier,
  townReputationTierMultiplier,
} from '@helpers/town/reputation/town-reputation';
import type { GameState, TownId, TownReputationTierValue } from '@interfaces';

// Shared resolution for any per-town knob authored as TownReputationTierValue[] (crafting queue size, shop item cap, ...) - falls back to the highest authored tier at or below the current one.
export function townReputationTierValueResolve(
  townId: TownId,
  tiers: TownReputationTierValue[],
  state?: GameState,
): number {
  const table: Partial<Record<number, number>> = {};
  tiers.forEach((entry) => {
    table[entry.tier] = entry.value;
  });

  return (
    townReputationTierMultiplier(townReputationTier(townId, state), table) ?? 0
  );
}
