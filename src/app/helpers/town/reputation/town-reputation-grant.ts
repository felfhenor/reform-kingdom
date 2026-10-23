import { worldCurrentLocationState } from '@helpers/state-game';
import { townReputationGain } from '@helpers/town/reputation/town-reputation';
import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';
import { townCommissionRefreshTierScaledSlots } from '@helpers/town/town-commission-generate';
import type { TownId, TownReputationGainSource } from '@interfaces';

// For non-tick callers only - awaiting inside a tick would defer the refresh past the tick's own log ordering.
// Returns the reputation actually gained, after clamping to the max.
export async function townReputationGainAndRefresh(
  townId: TownId,
  amount: number,
  source: TownReputationGainSource,
): Promise<number> {
  const { gained, tierChanged } = await townReputationGain(
    townId,
    amount,
    source,
  );
  if (!tierChanged) return gained;

  await townReputationBuffRefresh(worldCurrentLocationState().mapName);
  await townCommissionRefreshTierScaledSlots(townId);
  return gained;
}
