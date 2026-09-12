import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { TownId, TownReputationGainSource } from '@interfaces';

// Cumulative reputation needed to reach each tier (0 = Neutral .. 4 = Renowned) - a shared game-balance curve, not authored per-town.
export const TOWN_REPUTATION_THRESHOLDS: Record<number, number> = {
  0: 0,
  1: 100,
  2: 600,
  3: 2100,
  4: 7100,
};

export const TOWN_REPUTATION_TIER_NAMES: Record<number, string> = {
  0: 'Neutral',
  1: 'Friendly',
  2: 'Honored',
  3: 'Distinguished',
  4: 'Renowned',
};

const TIERS_DESCENDING = [4, 3, 2, 1, 0];

export function townReputationTierForAmount(reputation: number): number {
  return (
    TIERS_DESCENDING.find(
      (tier) => reputation >= TOWN_REPUTATION_THRESHOLDS[tier],
    ) ?? 0
  );
}

export function townReputationTierName(tier: number): string {
  return TOWN_REPUTATION_TIER_NAMES[tier] ?? 'Neutral';
}

export function townReputation(townId: TownId): number {
  return gamestate().world.towns[townId]?.reputation ?? 0;
}

export function townReputationTier(townId: TownId): number {
  return townReputationTierForAmount(townReputation(townId));
}

// Returns whether the gain crossed a tier threshold, so callers can re-sync the town's buff immediately.
// Awaits its own updateGamestate call so a non-tick caller sees the mutation land before checking the result.
export async function townReputationGain(
  townId: TownId,
  amount: number,
  source: TownReputationGainSource,
): Promise<boolean> {
  if (amount <= 0) return false;

  let tierChanged = false;

  await updateGamestate((state) => {
    const town = state.world.towns[townId];
    if (!town) return state;

    const previousTier = townReputationTierForAmount(town.reputation);
    town.reputation += amount;
    tierChanged =
      townReputationTierForAmount(town.reputation) !== previousTier;

    return state;
  });

  analyticsSendDesignEvent(`Town:Reputation:${source}`);

  return tierChanged;
}

// The sole subtraction path - reputation is otherwise cumulative-only, reserved for a raid loss.
// Returns whether the loss crossed a tier threshold - see townReputationGain for the async/tick-safety note.
export async function townReputationLose(
  townId: TownId,
  amount: number,
  source: TownReputationGainSource,
): Promise<boolean> {
  if (amount <= 0) return false;

  let tierChanged = false;

  await updateGamestate((state) => {
    const town = state.world.towns[townId];
    if (!town) return state;

    const previousTier = townReputationTierForAmount(town.reputation);
    town.reputation = Math.max(0, town.reputation - amount);
    tierChanged =
      townReputationTierForAmount(town.reputation) !== previousTier;

    return state;
  });

  analyticsSendDesignEvent(`Town:Reputation:Lose:${source}`);

  return tierChanged;
}

// Highest-defined tier at or below the current one - lets a table author only some tiers and still resolve sensibly below that.
export function townReputationTierMultiplier<T>(
  tier: number,
  table: Partial<Record<number, T>>,
): T | undefined {
  for (let t = tier; t >= 0; t--) {
    if (table[t] !== undefined) return table[t];
  }
  return undefined;
}
