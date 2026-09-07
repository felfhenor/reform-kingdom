import {
  TOWN_REPUTATION_THRESHOLDS,
  townReputation,
  townReputationTierForAmount,
  townReputationTierName,
} from '@helpers/town/reputation/town-reputation';
import type { TownId, TownReputationDisplay } from '@interfaces';

export function townReputationDisplay(townId: TownId): TownReputationDisplay {
  const reputation = townReputation(townId);
  const tier = townReputationTierForAmount(reputation);
  const nextTier = tier < 4 ? tier + 1 : undefined;

  return {
    reputation,
    tierName: townReputationTierName(tier),
    nextThreshold:
      nextTier !== undefined ? TOWN_REPUTATION_THRESHOLDS[nextTier] : undefined,
    nextTierName:
      nextTier !== undefined ? townReputationTierName(nextTier) : undefined,
  };
}
