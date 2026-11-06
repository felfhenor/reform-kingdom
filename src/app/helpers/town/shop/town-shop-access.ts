import { getEntry } from '@helpers/content/content';
import { globalEffectSumsState } from '@helpers/state-game';
import { townReputationTierValueResolve } from '@helpers/town/reputation/town-reputation-tier-value';
import type { TownContent, TownId } from '@interfaces';

// Reputation-tier-scaled - falls back to the highest authored tier at or below the current one.
export function townShopItemCap(townId: TownId): number {
  const town = getEntry<TownContent>(townId);
  if (!town || globalEffectSumsState().townShopNoEquipment) return 0;

  return townReputationTierValueResolve(townId, town.traders.sellItemCount);
}
