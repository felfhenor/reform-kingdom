import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  worldCurrentLocationState: vi.fn(() => ({ mapName: 'LarsianDesert' })),
}));

vi.mock('@helpers/town/reputation/town-reputation', () => ({
  townReputationGain: vi.fn(),
}));

vi.mock('@helpers/town/reputation/town-reputation-buff', () => ({
  townReputationBuffRefresh: vi.fn(),
}));

vi.mock('@helpers/town/town-commission-generate', () => ({
  townCommissionRefreshTierScaledSlots: vi.fn(),
}));

import { townReputationGain } from '@helpers/town/reputation/town-reputation';
import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';
import { townReputationGainAndRefresh } from '@helpers/town/reputation/town-reputation-grant';
import { townCommissionRefreshTierScaledSlots } from '@helpers/town/town-commission-generate';
import type { TownId } from '@interfaces';

const townId = 'larsia' as TownId;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townReputationGainAndRefresh', () => {
  it('refreshes the buff and tier-scaled commissions when the tier changes', async () => {
    vi.mocked(townReputationGain).mockResolvedValue(true);

    await townReputationGainAndRefresh(townId, 25, 'RaidBuyoff');

    expect(townReputationGain).toHaveBeenCalledWith(townId, 25, 'RaidBuyoff');
    expect(townReputationBuffRefresh).toHaveBeenCalledWith('LarsianDesert');
    expect(townCommissionRefreshTierScaledSlots).toHaveBeenCalledWith(townId);
  });

  it('skips the refresh when the tier is unchanged', async () => {
    vi.mocked(townReputationGain).mockResolvedValue(false);

    await townReputationGainAndRefresh(townId, 25, 'Commission');

    expect(townReputationBuffRefresh).not.toHaveBeenCalled();
    expect(townCommissionRefreshTierScaledSlots).not.toHaveBeenCalled();
  });
});
