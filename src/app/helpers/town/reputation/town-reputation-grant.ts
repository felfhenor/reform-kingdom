import { worldCurrentLocationState } from '@helpers/state-game';
import { townReputationGain } from '@helpers/town/reputation/town-reputation';
import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';
import { townCommissionRefreshTierScaledSlots } from '@helpers/town/town-commission-generate';
import type { TownId, TownReputationGainSource } from '@interfaces';

// For non-tick callers only - awaiting inside a tick would defer the refresh past the tick's own log ordering.
export async function townReputationGainAndRefresh(
  townId: TownId,
  amount: number,
  source: TownReputationGainSource,
): Promise<void> {
  const tierChanged = await townReputationGain(townId, amount, source);
  if (!tierChanged) return;

  await townReputationBuffRefresh(worldCurrentLocationState().mapName);
  await townCommissionRefreshTierScaledSlots(townId);
}
